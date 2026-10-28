import { app } from '../../../../../../playcanvas-stable.min.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { BaseCompositionRule } from './base-composition-rule.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../helpers/scene-transform-helper.mjs';

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
 * Composition rule для розтягування handle overlay елементів
 * коли Side-Shelf (Open Side Shelves) стоїть поруч з кабінетом.
 *
 * Таблиця трансформацій:
 *
 * StretchX (однаковий для всіх handles):
 *   HandleBotCut_Top, HandleNoCut_Top, HandleTopCut_Top,
 *   HandleNoCut_Bot, HandleTopCut_Bot → 0.15
 *
 * MoveX (залежить від сторони Side-Shelf):
 *   TopHandleMove_Point, BotHandleMove_Point
 *     Side-Shelf зліва:  -0.075
 *     Side-Shelf справа: +0.075
 *     Side-Shelf з обох:  0 (компенсуються)
 *
 * Логіка:
 * - Застосовується тільки до крайнього кабінету що межує з Side-Shelf
 * - Якщо Side-Shelf з обох сторін і 1 кабінет — stretch подвоюється, move = 0
 */ class RuleHandleStretchForSideShelf extends BaseCompositionRule {
    aggregateFn(compositions) {
        const cabinetsComp = compositions.cabinets;
        if (!cabinetsComp) return {
            hasCabinets: false
        };
        const allProducts = cabinetsComp.getAllProducts();
        const cabinetProducts = Object.entries(allProducts).filter(([_, p])=>p.category === 'cabinets');
        if (cabinetProducts.length === 0) return {
            hasCabinets: false
        };
        return {
            hasCabinets: true,
            allProducts,
            compositions
        };
    }
    async applyFn(result, context) {
        if (!result.hasCabinets) return;
        const compositionManager = context.app.compositionManager;
        const cabinets = compositionManager.getProductEntitiesByCategory('cabinets');
        if (cabinets.length === 0) return;
        // Синхронізуємо world transforms (handlers виконуються послідовно, попередні вже завершені)
        cabinets.forEach((e)=>e.syncHierarchy());
        const composition = compositionManager.getActiveComposition();
        if (!composition) return;
        const orderIds = composition.getOrderProductIds();
        // Сортуємо по order index
        const sorted = [
            ...cabinets
        ].sort((a, b)=>(orderIds[a.name] ?? 0) - (orderIds[b.name] ?? 0));
        const leftEdge = sorted[0];
        const rightEdge = sorted[sorted.length - 1];
        // Визначаємо чи є Side-Shelf на краях
        const hasSideShelfLeft = leftEdge.name.startsWith('Side-Shelf');
        const hasSideShelfRight = rightEdge.name.startsWith('Side-Shelf');
        const nonShelfCabinets = sorted.filter((e)=>!e.name.startsWith('Side-Shelf'));
        if (nonShelfCabinets.length === 0) return;
        // Спочатку скидаємо ВСІ кабінети до базового stretch
        // (важливо при swap/add — старий крайній кабінет може стати середнім)
        this._resetAllHandleStretch(nonShelfCabinets);
        // Якщо Side-Shelf відсутній — вже скинуто, нічого більше
        if (!hasSideShelfLeft && !hasSideShelfRight) return;
        if (hasSideShelfLeft) {
            const leftCabinet = nonShelfCabinets[0];
            this._applyStretchAndMove(leftCabinet, 'left', hasSideShelfRight && nonShelfCabinets.length === 1);
        }
        if (hasSideShelfRight) {
            const rightCabinet = nonShelfCabinets[nonShelfCabinets.length - 1];
            if (hasSideShelfLeft && nonShelfCabinets.length === 1) return;
            this._applyStretchAndMove(rightCabinet, 'right', false);
        }
        LoggerService.log(this, `[HandleStretchForSideShelf] Applied (left=${hasSideShelfLeft}, right=${hasSideShelfRight})`);
    }
    /**
     * Застосовує stretch + move до кабінету
     * @param {pc.Entity} cabinet
     * @param {'left'|'right'} sideShelfSide - з якої сторони Side-Shelf
     * @param {boolean} bothSides - Side-Shelf з обох сторін (1 кабінет)
     */ /**
     * Додає stretch + move ПОВЕРХ існуючого product rule stretch.
     * Не перезаписує, а збільшує фактичний stretch.
     */ _applyStretchAndMove(cabinet, sideShelfSide, bothSides) {
        const additionalStretch = bothSides ? RuleHandleStretchForSideShelf.STRETCH_X * 2 : RuleHandleStretchForSideShelf.STRETCH_X;
        // Отримуємо Width кабінету для розрахунку base stretch
        const config = this._getCabinetConfig(cabinet.name);
        const width = config?.Width || 60;
        const baseStretch = RuleHandleStretchForSideShelf.WIDTH_STRETCH_MAP[width] ?? 0;
        const stretchEntities = SceneEntityHelper.collectByNames(cabinet, RuleHandleStretchForSideShelf.HANDLE_STRETCH_ENTITIES);
        stretchEntities.forEach((entity)=>{
            // base (від Width) + additional (від Side-Shelf)
            SceneTransformHelper.setStretch(entity, {
                x: baseStretch + additionalStretch
            });
        });
        // MoveX для handle move points
        let moveX;
        if (bothSides) {
            moveX = 0;
        } else if (sideShelfSide === 'left') {
            moveX = -RuleHandleStretchForSideShelf.MOVE_X;
        } else {
            moveX = RuleHandleStretchForSideShelf.MOVE_X;
        }
        const moveEntities = SceneEntityHelper.collectByNames(cabinet, RuleHandleStretchForSideShelf.HANDLE_MOVE_ENTITIES);
        moveEntities.forEach((entity)=>{
            SceneTransformHelper.setLocalPosition(entity, {
                x: moveX
            });
        });
    }
    /**
     * Скидає stretch та move handles до базових значень (тільки по Width)
     * для всіх кабінетів. Викликається коли Side-Shelf видалений.
     * @private
     */ _resetAllHandleStretch(cabinets) {
        cabinets.forEach((cabinet)=>{
            const config = this._getCabinetConfig(cabinet.name);
            const width = config?.Width || 60;
            const baseStretch = RuleHandleStretchForSideShelf.WIDTH_STRETCH_MAP[width] ?? 0;
            const stretchEntities = SceneEntityHelper.collectByNames(cabinet, RuleHandleStretchForSideShelf.HANDLE_STRETCH_ENTITIES);
            stretchEntities.forEach((entity)=>{
                SceneTransformHelper.setStretch(entity, {
                    x: baseStretch
                });
            });
            const moveEntities = SceneEntityHelper.collectByNames(cabinet, RuleHandleStretchForSideShelf.HANDLE_MOVE_ENTITIES);
            moveEntities.forEach((entity)=>{
                SceneTransformHelper.setLocalPosition(entity, {
                    x: 0
                });
            });
        });
        LoggerService.log(this, `[HandleStretchForSideShelf] Reset ${cabinets.length} cabinet(s) to base stretch`);
    }
    /**
     * Отримати конфігурацію кабінету зі store
     * @private
     */ _getCabinetConfig(cabinetId) {
        const cm = this._getCompositionManager();
        if (!cm) return null;
        const composition = cm.getActiveComposition();
        return composition?.getProduct(cabinetId);
    }
    /**
     * @private
     */ _getCompositionManager() {
        // context.app доступний через applyFn context, але тут ми в method
        // Використовуємо глобальний доступ
        return app?.compositionManager;
    }
    constructor(){
        super({
            name: 'HandleStretchForSideShelf',
            watchCompositions: [
                'cabinets'
            ],
            watchParams: [
                'Width',
                'Height',
                'Depth'
            ]
        });
    }
}
_define_property(RuleHandleStretchForSideShelf, "STRETCH_X", 0.15);
_define_property(RuleHandleStretchForSideShelf, "MOVE_X", 0.075);
// Та сама таблиця що в RuleScaleWidthCabinetUniBox для Handle Top entities
_define_property(RuleHandleStretchForSideShelf, "WIDTH_STRETCH_MAP", {
    25: -0.35,
    35: -0.25,
    50: -0.1,
    60: 0.00,
    70: 0.10,
    80: 0.20,
    90: 0.30,
    105: 0.45,
    120: 0.60
});
_define_property(RuleHandleStretchForSideShelf, "HANDLE_STRETCH_ENTITIES", [
    'HandleBotCut_Top',
    'HandleNoCut_Top',
    'HandleTopCut_Top',
    'HandleNoCut_Bot',
    'HandleTopCut_Bot'
]);
_define_property(RuleHandleStretchForSideShelf, "HANDLE_MOVE_ENTITIES", [
    'TopHandleMove_Point',
    'BotHandleMove_Point'
]);

export { RuleHandleStretchForSideShelf };
