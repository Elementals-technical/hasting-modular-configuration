import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { BaseCompositionRule } from './base-composition-rule.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { cabinetBodyHeightM, BOOLEAN_CUTTER_NODE_MARKERS } from '../../addons/side-panel-group-measurement.mjs';

/**
 * TowelBar40_R is authored for a 56 cm cabinet whose root is at the cabinet bottom:
 * with TowelBar40_R_Point at Y=0 the bar sits correctly under a top at 0.56 m.
 * All collections keep the cabinet top at the cabinet height above the cabinet root (Height/100)
 * (ULH/Class/Mako/UF/Tricot countertop anchors), so the bar is aligned to the edge
 * cabinet top instead of a USH-only height table.
 */ const TOWEL_BAR_AUTHORED_TOP_M = 0.56;
const TOWEL_BAR_POINT_NAME = "TowelBar40_R_Point";
class RuleTowelBars extends BaseCompositionRule {
    aggregateFn(compositions) {
        const cabinetsComp = compositions.cabinets;
        if (!cabinetsComp) return {
            hasCabinets: false
        };
        const allProducts = cabinetsComp.getAllProducts();
        const cabinetProducts = Object.values(allProducts).filter((p)=>p.category === "cabinets");
        if (cabinetProducts.length === 0) return {
            hasCabinets: false
        };
        return {
            hasCabinets: true,
            cabinets: cabinetProducts,
            compositions: compositions
        };
    }
    async applyFn(result, context) {
        if (!result.hasCabinets) return;
        // Перераховуємо AABB live
        const compositionManager = context.app.compositionManager;
        const cabinets = compositionManager.getProductEntitiesByCategory('cabinets').filter((e)=>e.enabled);
        if (cabinets.length === 0) return;
        // Синхронізуємо world transforms (SmartStretch вже оновив AABB синхронно)
        cabinets.forEach((e)=>e.syncHierarchy());
        // Unused boolean cutters stay enabled and stick out of the cabinet back: without them the bar's Z
        // centres on the real cabinet depth, not up to 5.7 cm behind it.
        const ignoreNodesOf = (cab)=>[
                ...ProductRegistry_V2.instance.getAabbIgnoreNodesByEntity(cab.name),
                ...BOOLEAN_CUTTER_NODE_MARKERS
            ];
        let cabinetsAabb = null;
        const measured = [];
        cabinets.forEach((cab)=>{
            const aabb = SceneEntityHelper.traverseAabb(cab, ignoreNodesOf(cab));
            if (!aabb) return;
            measured.push({
                entity: cab,
                aabb
            });
            if (!cabinetsAabb) {
                cabinetsAabb = aabb.clone();
            } else {
                cabinetsAabb.add(aabb);
            }
        });
        if (!cabinetsAabb) {
            LoggerService.warn(this, "Failed to compute cabinets AABB");
            return;
        }
        const addons = compositionManager.getProductEntitiesByCategory('addons') || [];
        // Розширюємо AABB side panels (якщо є) — клонуємо щоб не мутувати
        const expandedAabb = cabinetsAabb.clone();
        const leftSidePanel = addons.find((e)=>e.name.includes("SidePanel_Left") && e.enabled);
        const rightSidePanel = addons.find((e)=>e.name.includes("SidePanel_Right") && e.enabled);
        if (leftSidePanel) {
            const panelAabb = SceneEntityHelper.traverseAabb(leftSidePanel);
            if (panelAabb) expandedAabb.add(panelAabb);
        }
        if (rightSidePanel) {
            const panelAabb = SceneEntityHelper.traverseAabb(rightSidePanel);
            if (panelAabb) expandedAabb.add(panelAabb);
        }
        const cabinetProducts = result.compositions?.cabinets?.getAllProducts?.() || {};
        const grouped = compositionManager.sidePanelAddon?.usesGroupPanels() === true;
        const edgeBounds = (side)=>{
            if (!grouped) return expandedAabb;
            const edge = this._edgeCabinet(measured, side);
            if (!edge) return cabinetsAabb;
            const bounds = edge.aabb.clone();
            for (const panel of addons){
                const config = cabinetProducts[panel.name];
                if (!panel.enabled || config?.side !== side || config.SidePanelAnchorCabinetId !== edge.entity.name) continue;
                const panelBounds = SceneEntityHelper.traverseAabb(panel);
                if (panelBounds) bounds.add(panelBounds);
            }
            return bounds;
        };
        const leftTowelBar = addons.find((e)=>e.name.includes("TowelBar_Left"));
        if (leftTowelBar && leftTowelBar.enabled) {
            const topY = this._edgeCabinetTopY(measured, cabinetProducts, "left");
            this._updatePosition(leftTowelBar, edgeBounds('left'), "left", topY);
        }
        const rightTowelBar = addons.find((e)=>e.name.includes("TowelBar_Right"));
        if (rightTowelBar && rightTowelBar.enabled) {
            const topY = this._edgeCabinetTopY(measured, cabinetProducts, "right");
            this._updatePosition(rightTowelBar, edgeBounds('right'), "right", topY);
        }
        LoggerService.log(this, "✅ [RuleTowelBars] Positioned towel bars");
    }
    _edgeCabinet(measured, side) {
        let edge = null;
        for (const item of measured){
            const x = side === "left" ? item.aabb.center.x - item.aabb.halfExtents.x : item.aabb.center.x + item.aabb.halfExtents.x;
            if (!edge || (side === "left" ? x < edge.x : x > edge.x)) {
                edge = {
                    ...item,
                    x
                };
            }
        }
        return edge;
    }
    /** World-Y of the top of the outermost cabinet on this side, or null. */ _edgeCabinetTopY(measured, cabinetProducts, side) {
        const edge = this._edgeCabinet(measured, side);
        const edgeConfig = cabinetProducts[edge?.entity.name];
        const heightM = edgeConfig ? cabinetBodyHeightM(ProductRegistry_V2.instance, edgeConfig) : NaN;
        return edge && Number.isFinite(heightM) && heightM > 0 ? edge.entity.getPosition().y + heightM : null;
    }
    _updatePosition(instance, cabinetsAabb, side, cabinetTopY = null) {
        if (side === "left") {
            instance.setLocalEulerAngles(0, 180, 0);
        } else {
            instance.setLocalEulerAngles(0, 0, 0);
        }
        instance.syncHierarchy();
        const towelBarAabb = SceneEntityHelper.traverseAabb(instance);
        if (!towelBarAabb) return;
        const currentPos = instance.getPosition();
        const cabinetEdgeX = side === "left" ? cabinetsAabb.center.x - cabinetsAabb.halfExtents.x : cabinetsAabb.center.x + cabinetsAabb.halfExtents.x;
        const barEdgeX = side === "left" ? towelBarAabb.center.x + towelBarAabb.halfExtents.x : towelBarAabb.center.x - towelBarAabb.halfExtents.x;
        const moveX = cabinetEdgeX - barEdgeX;
        const moveZ = cabinetsAabb.center.z - towelBarAabb.center.z;
        // Y: compensate the point offset left by RuleChangeTowelBarHeight, so the bar
        // follows the edge cabinet top for any collection, height change or raised row.
        const pointY = instance.findByName(TOWEL_BAR_POINT_NAME)?.getLocalPosition().y ?? 0;
        const targetY = Number.isFinite(cabinetTopY) ? cabinetTopY - TOWEL_BAR_AUTHORED_TOP_M - pointY : currentPos.y;
        instance.setPosition(currentPos.x + moveX, targetY, currentPos.z + moveZ);
    }
    constructor(){
        super({
            name: "TowelBars",
            watchCompositions: [
                "cabinets",
                "addons"
            ],
            watchParams: [
                "Width",
                "Height",
                "Handle",
                "Depth",
                "TowelBarType",
                "SidePanelType",
                'SpatialOffsetM',
                'SupportGroupId'
            ]
        });
    }
}

export { RuleTowelBars };
