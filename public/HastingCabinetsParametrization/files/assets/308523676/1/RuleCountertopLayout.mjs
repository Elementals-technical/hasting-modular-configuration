import { BaseCompositionRule } from './base-composition-rule.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { CABINET_LAYOUT_GAP_METERS } from '../layout-constants.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import {
    calculateCountertopBaseX,
    calculateStandardCountertopLayout,
    COUNTERTOP_INTRINSIC_LENGTH_M,
    SIDE_SHELF_WIDTH_LEGACY_CM
} from '../../countertop/countertop-layout-policy.mjs';
import {
    COUNTERTOP_PLACEMENT,
    COUNTERTOP_POSITIONING,
    DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID,
    resolveCountertopPositioningProfile,
    selectCountertopSupportGroup,
    resolveCountertopSupportBase
} from '../../countertop/countertop-support-resolver.mjs';
import {
    measureCabinetCountertopSupport,
    measureCountertopMountWorldY,
    resolvedRootWorldYToLocalY
} from '../../countertop/adapters/countertop-support-measurement.mjs';
import { isTandemCountertopProduct, resolveBasinTopProduct } from '../../countertop/countertop-role.mjs';
import { basinTopPolicyOf } from '../../countertop/countertop-collections.mjs';
import { selectBasinTopCabinets } from '../../countertop/basin-top-policies.mjs';
import { cabinetFootprintIgnoreNodes } from '../../addons/side-panel-group-measurement.mjs';
import { COUNTERTOP_SINK_POINT_NAME } from '../../countertop/countertop-hosted-sink.mjs';

/**
 * The top's own pivot correction measures the top alone: a hosted sink (`Countertop_SinkPoint`, HR-CT-02) is its child
 * and may stick out of it (a Standard top whose sink hangs where it was carried), which shifted the standard X.
 */
const COUNTERTOP_OWN_AABB_IGNORE = Object.freeze([COUNTERTOP_SINK_POINT_NAME]);

const readSnapshotValue = (snapshot, key) => (
    typeof snapshot?.get === 'function' ? snapshot.get(key) : snapshot?.[key]
);

/**
 * Builds one complete standard countertop layout plan.
 *
 * Horizontal X/length math lives in countertop-layout-policy. Vertical support-plane math lives
 * in countertop-support-resolver. This rule only measures the current PlayCanvas scene, combines
 * both results, and submits one atomic X/Y/length update to the composition adapter.
 */
export class RuleCountertopLayout extends BaseCompositionRule {
    static SIDE_SHELF_NAME_PART = 'Side-Shelf';
    static SIDE_SHELF_WIDTH = SIDE_SHELF_WIDTH_LEGACY_CM;

    static COUNTERTOP_CATEGORY = 'countertops';
    static CABINETS_CATEGORY = 'cabinets';
    static COUNTERTOP_MESH_NAME = 'TopSolid';

    constructor() {
        super({
            name: 'CountertopLayout',
            watchCompositions: ['cabinets'],
            watchParams: [
                'Width', 'Depth', 'Height', 'Thickness', 'sinkType', 'SidePanel', 'SpatialOffsetM', 'ShowUndertop',
                'CountertopPositioning', 'CountertopPlacement', 'SupportGroupId', 'Handle',
                'SidePanelType', 'SidePanelRequestedType', 'productType', 'enabled'
            ]
        });
    }

    static SIDE_PANEL_ADJACENCY_TOLERANCE_M = 0.02;

    /**
     * A joint strip (SidePanelFace 'joint') sits between cabinets of different heights and must not lengthen
     * or shift the top; only end panels (and legacy panels without a face) count.
     * Example: isEndSidePanel({ config: { SidePanelFace: 'joint' } }) === false.
     */
    static isEndSidePanel(panel) {
        return panel?.config?.SidePanelFace !== 'joint';
    }

    /** World X/Y extent of the measured support-group cabinets, or null when nothing measured. */
    static measureGroupExtent(boundsList) {
        const valid = (boundsList || []).filter(bounds => (
            Number.isFinite(Number(bounds?.center?.x)) && Number.isFinite(Number(bounds?.halfExtents?.x))
        ));
        if (!valid.length) return null;
        const extent = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        valid.forEach(bounds => {
            const cx = Number(bounds.center.x); const hx = Number(bounds.halfExtents.x);
            const cy = Number(bounds.center.y); const hy = Number(bounds.halfExtents.y);
            extent.minX = Math.min(extent.minX, cx - hx);
            extent.maxX = Math.max(extent.maxX, cx + hx);
            if (Number.isFinite(cy) && Number.isFinite(hy)) {
                extent.minY = Math.min(extent.minY, cy - hy);
                extent.maxY = Math.max(extent.maxY, cy + hy);
            }
        });
        return extent;
    }

    /**
     * A side panel belongs to the group when the group sits on the outer cabinet edge where
     * RuleSidePanels will place that panel (left panel: group minX == all cabinets' minX; right
     * panel: group maxX == all cabinets' maxX) and the panel's Y range overlaps the group.
     * X is derived from the cabinets, not the panel's current AABB: this rule runs before
     * RuleSidePanels, so the panel entity may still be at a stale X. RuleSidePanels keeps Y.
     */
    static isSidePanelAdjacentToGroup(panel, panelEntity, groupExtent, outerExtent) {
        if (!panelEntity || !groupExtent || !outerExtent || panelEntity.enabled === false) return false;
        const tolerance = RuleCountertopLayout.SIDE_PANEL_ADJACENCY_TOLERANCE_M;
        const onEdge = panel.side === 'left'
            ? Math.abs(groupExtent.minX - outerExtent.minX) <= tolerance
            : Math.abs(groupExtent.maxX - outerExtent.maxX) <= tolerance;
        if (!onEdge) return false;
        const bounds = SceneEntityHelper.traverseAabb(panelEntity);
        const cy = Number(bounds?.center?.y); const hy = Number(bounds?.halfExtents?.y);
        if (!Number.isFinite(groupExtent.minY) || !Number.isFinite(cy) || !Number.isFinite(hy)) return true;
        return cy - hy < groupExtent.maxY + tolerance && cy + hy > groupExtent.minY - tolerance;
    }

    /** Body extent of every enabled cabinet (same footprint ignore list as the group). */
    static measureOuterCabinetExtent(registry, cabinetEntities, allProducts) {
        const bounds = (cabinetEntities || [])
            .filter(entity => entity && entity.enabled !== false)
            .map(entity => {
                entity.syncHierarchy?.();
                return SceneEntityHelper.traverseAabb(
                    entity,
                    RuleCountertopLayout.cabinetFootprintIgnoreNodes(registry, allProducts?.[entity.name] || {}, entity.name)
                );
            })
            .filter(Boolean);
        return RuleCountertopLayout.measureGroupExtent(bounds);
    }

    aggregateFn(compositions) {
        const allProducts = [];
        Object.values(compositions).forEach(composition => {
            allProducts.push(...Object.values(composition.getAllProducts()));
        });
        return { allProducts, compositions };
    }

    async applyFn(result, context) {
        // Tandem tops first: the basin top's 'change' (pricing reads tandemTops from it) then carries their lengths.
        this.layoutTandemTops(context);
        await this.applyBasinTop(result, context);
    }

    /** The one basin top: its complete standard X/Y/length plan to the countertop composition adapter. */
    async applyBasinTop(result, context) {
        const { shared } = context;
        const compositionAdapter = context.app.compositionManager?.countertopCompositionAdapter;
        const freeLayout = context.app.compositionManager?.preserveCabinetPositions === true;
        const allProducts = shared?.allProducts || {};
        const basinResolution = resolveBasinTopProduct(allProducts);
        const registry = ProductRegistry_V2.instance;
        const panelAddon = context.app.compositionManager?.sidePanelAddon;
        const groupPanelPlan = panelAddon?.usesGroupPanels(shared?.composition)
            ? await panelAddon.prepareGroupPlan(shared) : null;
        if (groupPanelPlan && groupPanelPlan.status !== 'ready') {
            LoggerService.warn(this, '[RuleCountertopLayout] Side panel group geometry unresolved');
            return;
        }
        // Ensure assets/products exist before including their allowance in the countertop length.
        // RuleSidePanels reuses these targets and aligns their final geometry later in this cycle.
        if (groupPanelPlan) await panelAddon.materializeGroupPlan(shared, groupPanelPlan);
        let cabinetEntities = freeLayout && basinResolution.status === 'found'
            ? selectCountertopSupportGroup(shared?.entities?.cabinets || [], allProducts, basinResolution.productId)
            : shared?.entities?.cabinets || [];
        // Line with mixed heights (e.g. UF 88 + 53): the collection's basin top policy may leave
        // some cabinets out from under the top; those cabinets get covers instead.
        if (!freeLayout && basinResolution.status === 'found') {
            const cabinetsUnderTop = RuleCountertopLayout.selectCabinetsUnderBasinTop(registry, cabinetEntities, allProducts);
            if (cabinetsUnderTop) cabinetEntities = cabinetEntities.filter(entity => cabinetsUnderTop.has(entity.name));
        }
        // When the top lies on only part of the cabinets, side panels and entities are limited to that part
        // (free layout always works this way: one top per row).
        const topCoversPartOfCabinets = freeLayout || cabinetEntities.length < (shared?.entities?.cabinets?.length ?? 0);

        if (freeLayout && !cabinetEntities.length && shared?.entities?.cabinets?.length) {
            LoggerService.warn(this, '[RuleCountertopLayout] No cabinets in the countertop support group');
            return;
        }

        if (cabinetEntities.length === 0) {
            compositionAdapter?.resetForComposition(
                shared?.composition?.compositionId || context.compositionId,
                'countertop-layout-empty'
            );
            return;
        }

        cabinetEntities.forEach(entity => entity.syncHierarchy());

        const cabinets = [];
        const cabinetSupportFacts = [];
        const groupBoundsM = [];

        cabinetEntities.forEach(entity => {
            const snapshot = allProducts[entity.name];
            if (!snapshot) return;
            const bounds = SceneEntityHelper.traverseAabb(
                entity,
                RuleCountertopLayout.cabinetFootprintIgnoreNodes(registry, snapshot, entity.name)
            );

            cabinets.push({
                name: entity.name,
                isSideShelf: entity.name.includes(RuleCountertopLayout.SIDE_SHELF_NAME_PART),
                widthLegacyCm: snapshot.Width,
                boundsM: {
                    centerX: Number(bounds?.center?.x),
                    halfExtentX: Number(bounds?.halfExtents?.x)
                }
            });
            if (bounds) groupBoundsM.push(bounds);
            cabinetSupportFacts.push(measureCabinetCountertopSupport({
                entity,
                snapshot,
                registry
            }));
        });

        const countertops = shared?.entities?.countertops || [];
        const countertop = basinResolution.status === 'found'
            ? countertops.find(entity => entity?.name === basinResolution.productId) ?? null
            : null;
        if (!countertop) {
            compositionAdapter?.resetForComposition(
                shared?.composition?.compositionId || context.compositionId,
                basinResolution.status === 'ambiguous'
                    ? 'countertop-role-ambiguous'
                    : 'countertop-entity-missing'
            );
            if (basinResolution.status === 'ambiguous') {
                LoggerService.warn(this, '[RuleCountertopLayout] Basin countertop role is ambiguous', {
                    candidateIds: basinResolution.candidateIds
                });
            }
            return;
        }
        const countertopConfig = allProducts[countertop.name] || {};

        const addonEntities = shared?.entities?.addons || [];
        const groupExtent = topCoversPartOfCabinets ? RuleCountertopLayout.measureGroupExtent(groupBoundsM) : null;
        const outerExtent = topCoversPartOfCabinets
            ? RuleCountertopLayout.measureOuterCabinetExtent(registry, shared?.entities?.cabinets, allProducts)
            : null;
        const topGroupId = readSnapshotValue(allProducts[countertop.name], 'SupportGroupId') || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
        const sidePanels = groupPanelPlan ? groupPanelPlan.panels
            .filter(panel => RuleCountertopLayout.isEndSidePanel(panel))
            .filter(panel => panel.groupId === topGroupId && cabinetEntities.some(entity => entity.name === panel.cabinetId))
            .map(({ side }) => ({ side })) : Object.entries(allProducts)
            .filter(([, product]) => {
                const productType = String(product?.productType || '');
                return productType.endsWith('SidePanel_Left') || productType.endsWith('SidePanel_Right');
            })
            .map(([panelId, panel]) => ({
                panelId,
                side: String(panel.productType).endsWith('SidePanel_Left') ? 'left' : 'right'
            }))
            // Top on part of the cabinets: a panel next to other cabinets must not lengthen or shift this top.
            .filter(panel => !topCoversPartOfCabinets || RuleCountertopLayout.isSidePanelAdjacentToGroup(
                panel,
                addonEntities.find(entity => entity?.name === panel.panelId),
                groupExtent,
                outerExtent
            ))
            .map(({ side }) => ({ side }));

        const countertopWorldPosition = countertop.getPosition();
        const countertopBounds = SceneEntityHelper.traverseAabb(countertop, COUNTERTOP_OWN_AABB_IGNORE);
        const intrinsicPivotCorrectionXM = Number(countertopBounds?.center?.x ?? 0)
            - Number(countertopWorldPosition?.x ?? 0);

        // Horizontal policy: X and automatic length only.
        const horizontalLayout = calculateStandardCountertopLayout({
            cabinets,
            layoutItemCount: cabinetEntities.length,
            sidePanels,
            cabinetGapM: CABINET_LAYOUT_GAP_METERS,
            countertopIntrinsicPivotXM: intrinsicPivotCorrectionXM,
            countertopIntrinsicLengthM: COUNTERTOP_INTRINSIC_LENGTH_M
        });
        if (freeLayout && horizontalLayout.hasBounds) {
            // A free arrangement is measured, not the sum of widths of overlapping rows.
            horizontalLayout.autoLengthM = horizontalLayout.groupMaxXM - horizontalLayout.groupMinXM + sidePanels.length * .01;
            horizontalLayout.stretchXM = horizontalLayout.autoLengthM - COUNTERTOP_INTRINSIC_LENGTH_M;
        }

        const localPosition = countertop.getLocalPosition();
        const positioningProfile = resolveCountertopPositioningProfile({
            cabinets: cabinetEntities.map(entity => allProducts[entity.name]).filter(Boolean),
            getProductConfig: productType => registry.getProductConfig(productType)
        });
        const positioning = readSnapshotValue(countertopConfig, 'CountertopPositioning')
            || positioningProfile.strategy;
        const placement = readSnapshotValue(countertopConfig, 'CountertopPlacement')
            || COUNTERTOP_PLACEMENT.SUPPORTED;
        const supportGroupId = readSnapshotValue(countertopConfig, 'SupportGroupId')
            || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;

        // Vertical policy: supported root world-Y only; no PlayCanvas mutation.
        const supportResolution = resolveCountertopSupportBase({
            positioning,
            placement,
            currentRootWorldY: Number(countertopWorldPosition?.y),
            mountWorldY: measureCountertopMountWorldY({ countertop, registry }),
            supports: cabinetSupportFacts.filter(support => support.groupId === supportGroupId)
        });
        const resolvedLocalY = supportResolution.status === 'resolved'
            ? resolvedRootWorldYToLocalY(countertop, supportResolution.rootWorldY)
            : null;
        const binding = compositionAdapter?.binding;
        const sameRoot = binding?.productId === countertop.name && binding?.assembly?.countertop?.root === countertop;
        const fallbackY = freeLayout && sameRoot ? binding.basePositionM.y : Number(localPosition.y);
        const baseY = resolvedLocalY ?? fallbackY;

        if (positioning === COUNTERTOP_POSITIONING.SUPPORT_PLANE && supportResolution.status === 'unresolved') {
            LoggerService.warn(this, '[RuleCountertopLayout] Countertop support plane unresolved', {
                countertopId: countertop.name,
                supportGroupId,
                reason: supportResolution.reason
            });
        }

        // One writer call with the complete X/Y/length plan. Spatial re-applies the manual offset.
        compositionAdapter?.updateStandardLayout({
            composition: shared?.composition,
            compositionId: shared?.composition?.compositionId || context.compositionId,
            entities: topCoversPartOfCabinets ? { ...shared?.entities, cabinets: cabinetEntities } : shared?.entities,
            layout: horizontalLayout,
            basePositionM: {
                x: horizontalLayout.baseXM,
                y: baseY,
                z: Number(localPosition.z)
            }
        });
    }

    /**
     * Tandem tops (countertop/tandem/tandem-countertops.mjs): the clones of a thin basin top on sink bases set apart.
     * Each lies on the cabinets of its SupportGroupId like the basin top on its row: the same horizontal policy (a free
     * arrangement measured) and the same support plane, always Standard (no offset, no custom length, no side panels).
     * The tandem top writer applies the plan; tops that are gone are forgotten.
     */
    layoutTandemTops(context) {
        const { shared } = context;
        const writer = context.app.compositionManager?.tandemCountertopWriter;
        if (!writer) return;
        const allProducts = shared?.allProducts || {};
        const tandemIds = Object.keys(allProducts).filter(id => isTandemCountertopProduct(allProducts[id]));
        writer.prune(new Set(tandemIds));
        if (!tandemIds.length) return;
        const registry = ProductRegistry_V2.instance;
        const freeLayout = context.app.compositionManager?.preserveCabinetPositions === true;
        const countertops = shared?.entities?.countertops || [];
        for (const productId of tandemIds) {
            const countertop = countertops.find(entity => entity?.name === productId) ?? null;
            const mesh = countertop?.findByName?.(RuleCountertopLayout.COUNTERTOP_MESH_NAME) ?? null;
            const cabinetEntities = selectCountertopSupportGroup(shared?.entities?.cabinets || [], allProducts, productId)
                .filter(entity => entity && entity.enabled !== false);
            if (!countertop || !mesh || !cabinetEntities.length) continue;
            const plan = RuleCountertopLayout.planStandardLayout({ countertop, cabinetEntities, allProducts, registry, freeLayout });
            if (!plan) continue;
            writer.layout({ productId, root: countertop, mesh, basePositionM: plan.basePositionM, lengthM: plan.lengthM });
        }
    }

    /**
     * Standard plan of a top lying on `cabinetEntities` without side panels: { basePositionM (local), lengthM } or
     * null when nothing measured. The basin top's own path (applyBasinTop) does the same with side panels and its offset.
     */
    static planStandardLayout({ countertop, cabinetEntities, allProducts, registry, freeLayout }) {
        const cabinets = [];
        const supports = [];
        cabinetEntities.forEach(entity => {
            const snapshot = allProducts[entity.name];
            if (!snapshot) return;
            entity.syncHierarchy?.();
            const bounds = SceneEntityHelper.traverseAabb(
                entity,
                RuleCountertopLayout.cabinetFootprintIgnoreNodes(registry, snapshot, entity.name)
            );
            cabinets.push({
                name: entity.name,
                isSideShelf: entity.name.includes(RuleCountertopLayout.SIDE_SHELF_NAME_PART),
                widthLegacyCm: snapshot.Width,
                boundsM: { centerX: Number(bounds?.center?.x), halfExtentX: Number(bounds?.halfExtents?.x) }
            });
            supports.push(measureCabinetCountertopSupport({ entity, snapshot, registry }));
        });
        if (!cabinets.length) return null;
        countertop.syncHierarchy?.();
        const worldPosition = countertop.getPosition();
        const countertopBounds = SceneEntityHelper.traverseAabb(countertop, COUNTERTOP_OWN_AABB_IGNORE);
        const horizontalLayout = calculateStandardCountertopLayout({
            cabinets,
            layoutItemCount: cabinetEntities.length,
            sidePanels: [],
            cabinetGapM: CABINET_LAYOUT_GAP_METERS,
            countertopIntrinsicPivotXM: Number(countertopBounds?.center?.x ?? 0) - Number(worldPosition?.x ?? 0),
            countertopIntrinsicLengthM: COUNTERTOP_INTRINSIC_LENGTH_M
        });
        if (freeLayout && horizontalLayout.hasBounds) {
            horizontalLayout.autoLengthM = horizontalLayout.groupMaxXM - horizontalLayout.groupMinXM;
        }
        if (!Number.isFinite(horizontalLayout.baseXM) || !(horizontalLayout.autoLengthM > 0)) return null;
        const config = allProducts[countertop.name] || {};
        const positioningProfile = resolveCountertopPositioningProfile({
            cabinets: cabinetEntities.map(entity => allProducts[entity.name]).filter(Boolean),
            getProductConfig: productType => registry.getProductConfig(productType)
        });
        const supportGroupId = readSnapshotValue(config, 'SupportGroupId') || DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID;
        const supportResolution = resolveCountertopSupportBase({
            positioning: readSnapshotValue(config, 'CountertopPositioning') || positioningProfile.strategy,
            placement: readSnapshotValue(config, 'CountertopPlacement') || COUNTERTOP_PLACEMENT.SUPPORTED,
            currentRootWorldY: Number(worldPosition?.y),
            mountWorldY: measureCountertopMountWorldY({ countertop, registry }),
            supports: supports.filter(support => support.groupId === supportGroupId)
        });
        const localPosition = countertop.getLocalPosition();
        const resolvedLocalY = supportResolution.status === 'resolved'
            ? resolvedRootWorldYToLocalY(countertop, supportResolution.rootWorldY)
            : null;
        return {
            basePositionM: { x: horizontalLayout.baseXM, y: resolvedLocalY ?? Number(localPosition.y), z: Number(localPosition.z) },
            lengthM: horizontalLayout.autoLengthM
        };
    }

    /**
     * Cabinets the basin top lies on, chosen by the collection's basin top policy
     * (countertop-collections.mjs -> basin-top-policies.mjs).
     * Returns a Set of cabinet ids, or null = the top lies on all cabinets (no policy, or the
     * policy does not split this line).
     *   UF, SB 88 + SC 53 -> Set { SB }   (the highest cabinet; SC 53 gets a cover)
     */
    static selectCabinetsUnderBasinTop(registry, cabinetEntities, allProducts) {
        // 1. The collection decides: no policy (ULH, Class, Mako, mixed collections) -> top on all.
        const productTypes = cabinetEntities.map(entity => readSnapshotValue(allProducts[entity.name], 'productType'));
        const policyId = basinTopPolicyOf(productTypes);
        if (!policyId) return null;

        // 2. Measure each cabinet; one unmeasured cabinet -> do not guess, top on all.
        const measuredCabinets = [];
        for (const entity of cabinetEntities) {
            const measured = RuleCountertopLayout.measureCabinetForBasinTop(registry, entity, allProducts[entity.name]);
            if (!measured) return null;
            measuredCabinets.push(measured);
        }

        // 3. The policy picks the cabinets under the top.
        return selectBasinTopCabinets(policyId, measuredCabinets);
    }

    /**
     * One cabinet as a basin top policy sees it: { id, worldY (top of the cabinet), xMinM, xMaxM }.
     * null when the cabinet has no snapshot or no measurable body yet.
     */
    static measureCabinetForBasinTop(registry, entity, snapshot) {
        if (!snapshot) return null;
        entity.syncHierarchy?.();
        const bounds = SceneEntityHelper.traverseAabb(
            entity,
            RuleCountertopLayout.cabinetFootprintIgnoreNodes(registry, snapshot, entity.name)
        );
        if (!bounds) return null;
        return {
            id: entity.name,
            worldY: measureCabinetCountertopSupport({ entity, snapshot, registry }).worldY,
            xMinM: bounds.center.x - bounds.halfExtents.x,
            xMaxM: bounds.center.x + bounds.halfExtents.x
        };
    }

    /**
     * AABB ignore nodes of a cabinet's footprint. The sink under the cabinet's sink mount (with
     * its cutters) is carried by the countertop: a moved top moves it too. Measuring it would feed
     * the countertop's own offset back into its standard X and length, so after every drop the
     * layout re-based the top and left the sink behind (the top and its sink drift apart).
     */
    static cabinetFootprintIgnoreNodes(registry, snapshot, entityName) {
        return cabinetFootprintIgnoreNodes(registry, { productType: readSnapshotValue(snapshot, 'productType') }, entityName);
    }

    /** Backward-compatible calculation helper retained while older callers migrate. */
    calcCountertopTargetX(productConfig, countertopData) {
        const getBox = object => object?.boundyBox || object?.boundybox;
        const getPos = object => object?.position || object?.pos;
        const cabinets = Object.values(productConfig || {}).map(item => {
            const box = getBox(item);
            return {
                boundsM: {
                    centerX: Number(box?.center?.x),
                    halfExtentX: Number(box?.halfExtents?.x)
                }
            };
        });
        const countertopBox = getBox(countertopData);
        const countertopPosition = getPos(countertopData);
        const intrinsicPivotCorrectionXM = Number(countertopBox?.center?.x ?? 0)
            - Number(countertopPosition?.x ?? 0);
        const calculation = calculateCountertopBaseX({
            cabinets,
            countertopIntrinsicPivotXM: intrinsicPivotCorrectionXM
        });

        return {
            targetX: calculation.cabinetBaseXM,
            groupCenterX: calculation.groupCenterXM,
            groupMinX: calculation.groupMinXM,
            groupMaxX: calculation.groupMaxXM,
            ...(calculation.hasBounds ? { offsetX: calculation.intrinsicPivotCorrectionXM } : {})
        };
    }
}
