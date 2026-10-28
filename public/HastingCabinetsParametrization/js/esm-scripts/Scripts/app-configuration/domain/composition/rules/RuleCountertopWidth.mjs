import { BaseCompositionRule } from './base-composition-rule.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { CABINET_LAYOUT_GAP_METERS } from '../layout-constants.mjs';
import { calculateStandardCountertopLayout, COUNTERTOP_INTRINSIC_LENGTH_M, calculateCountertopBaseX, SIDE_SHELF_WIDTH_LEGACY_CM } from '../../countertop/countertop-layout-policy.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * Правило агрегації ширини стільниці.
 *
 * Підсумовує Width всіх продуктів та встановлює stretch стільниці.
 */ class RuleCountertopWidth extends BaseCompositionRule {
    /**
     * Агрегує ширину та глибину всіх продуктів
     */ aggregateFn(compositions) {
        const allProducts = [];
        Object.values(compositions).forEach((comp)=>{
            allProducts.push(...Object.values(comp.getAllProducts()));
        });
        return {
            allProducts: allProducts,
            compositions: compositions
        };
    }
    /**
     * Застосовує stretch до стільниці
     */ async applyFn(result, context) {
        const { shared } = context;
        const compositionAdapter = context.app.compositionManager?.countertopCompositionAdapter;
        // Entities з shared context
        const entities = shared?.entities?.cabinets || [];
        if (entities.length === 0) {
            compositionAdapter?.resetForComposition(shared?.composition?.compositionId || context.compositionId, 'countertop-layout-empty');
            return;
        }
        // Синхронізуємо world transforms (SmartStretch вже оновив AABB синхронно)
        entities.forEach((e)=>e.syncHierarchy());
        const allProducts = shared?.allProducts || {};
        const cabinets = [];
        entities.forEach((entity)=>{
            const config = allProducts[entity.name];
            if (!config) return;
            const bounds = SceneEntityHelper.traverseAabb(entity, ProductRegistry_V2.instance.getAabbIgnoreNodesByEntity(entity.name));
            cabinets.push({
                name: entity.name,
                isSideShelf: entity.name.includes(RuleCountertopWidth.SIDE_SHELF_NAME_PART),
                widthLegacyCm: config.Width,
                boundsM: {
                    centerX: Number(bounds?.center?.x),
                    halfExtentX: Number(bounds?.halfExtents?.x)
                }
            });
        });
        // Countertops з shared context
        const countertops = shared?.entities?.countertops || [];
        if (countertops.length === 0) {
            compositionAdapter?.resetForComposition(shared?.composition?.compositionId || context.compositionId, 'countertop-entity-missing');
            return;
        }
        const countertop = countertops[0];
        if (!countertop) return;
        // Side panels з shared allProducts
        const nameList = [
            "SidePanel_Left",
            "SidePanel_Right"
        ];
        const listSidePanel = Object.values(allProducts).filter((i)=>nameList.includes(i.productType));
        const sidePanels = listSidePanel.map((panel)=>({
                side: panel.productType === "SidePanel_Left" ? "left" : "right"
            }));
        const dataCountertop = {
            position: countertop.getPosition(),
            boundybox: SceneEntityHelper.traverseAabb(countertop)
        };
        const intrinsicPivotCorrectionXM = Number(dataCountertop.boundybox?.center?.x ?? 0) - Number(dataCountertop.position?.x ?? 0);
        const layout = calculateStandardCountertopLayout({
            cabinets,
            layoutItemCount: entities.length,
            sidePanels,
            cabinetGapM: CABINET_LAYOUT_GAP_METERS,
            countertopIntrinsicPivotXM: intrinsicPivotCorrectionXM,
            countertopIntrinsicLengthM: COUNTERTOP_INTRINSIC_LENGTH_M
        });
        const localPosition = countertop.getLocalPosition();
        // CT-07 composition adapter is the only X-length writer. Do not await
        // here: the following Boolean composition rule consumes the pending
        // request after assigning the latest cutters; the adapter's whenSettled()
        // remains the completion boundary for the geometry work.
        compositionAdapter?.updateStandardLayout({
            composition: shared?.composition,
            compositionId: shared?.composition?.compositionId || context.compositionId,
            entities: shared?.entities,
            layout,
            basePositionM: {
                x: layout.baseXM,
                y: Number(localPosition.y),
                z: Number(localPosition.z)
            }
        });
    }
    calcCountertopTargetX(productConfig, countertopData) {
        const getBox = (obj)=>obj?.boundyBox || obj?.boundybox;
        const getPos = (obj)=>obj?.position || obj?.pos;
        const cabinets = Object.values(productConfig || {}).map((item)=>{
            const box = getBox(item);
            return {
                boundsM: {
                    centerX: Number(box?.center?.x),
                    halfExtentX: Number(box?.halfExtents?.x)
                }
            };
        });
        const cBox = getBox(countertopData);
        const cPos = getPos(countertopData);
        const intrinsicPivotCorrectionXM = Number(cBox?.center?.x ?? 0) - Number(cPos?.x ?? 0);
        const result = calculateCountertopBaseX({
            cabinets,
            countertopIntrinsicPivotXM: intrinsicPivotCorrectionXM
        });
        return {
            targetX: result.cabinetBaseXM,
            groupCenterX: result.groupCenterXM,
            groupMinX: result.groupMinXM,
            groupMaxX: result.groupMaxXM,
            ...result.hasBounds ? {
                offsetX: result.intrinsicPivotCorrectionXM
            } : {}
        };
    }
    constructor(){
        super({
            name: 'CountertopWidth',
            watchCompositions: [
                'cabinets'
            ],
            watchParams: [
                'Width',
                'Depth',
                'Height',
                'Thickness',
                'sinkType',
                "SidePanel",
                'SpatialOffsetM'
            ]
        });
    }
}
/**
     * Доменні константи
     */ _define_property(RuleCountertopWidth, "SIDE_SHELF_NAME_PART", "Side-Shelf");
_define_property(RuleCountertopWidth, "SIDE_SHELF_WIDTH", SIDE_SHELF_WIDTH_LEGACY_CM);
_define_property(RuleCountertopWidth, "COUNTERTOP_CATEGORY", "countertops");
_define_property(RuleCountertopWidth, "CABINETS_CATEGORY", "cabinets");
_define_property(RuleCountertopWidth, "COUNTERTOP_MESH_NAME", "TopSolid");

export { RuleCountertopWidth };
