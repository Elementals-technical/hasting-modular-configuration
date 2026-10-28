import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */ class RuleScaleHeightUniSideShelves extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = parseInt(currentState.get('Height'));
        LoggerService.log(this, `📏 [RuleScaleHeight] Executing for height: ${height}`, {
            previousHeight: previousState?.get('Height')
        });
        if (Number.isNaN(height)) {
            LoggerService.log(this, '⚠️ [RuleScaleHeight] height is NaN, skip');
            return;
        }
        this._applyStretchY(height, this.dataHeightSizeProduct.stretch);
        this._applyMoveY(height, this.dataHeightSizeProduct.move);
    }
    // ================== helpers ==================
    _getValueForHeight(map, height) {
        if (!map) return undefined;
        // напряму числом
        if (Object.prototype.hasOwnProperty.call(map, height)) {
            return map[height];
        }
        // або ключі-строки
        const key = Object.keys(map).find((k)=>parseInt(k) === height);
        return key ? map[key] : undefined;
    }
    // ================== StretchY ==================
    _applyStretchY(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            if (!configForMesh) {
                LoggerService.log(this, '[RuleScaleWidth] No config for mesh name', {
                    entityName: entity.name
                });
                return;
            }
            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(this, '[RuleScaleHeight] No value for height', {
                    entityName: entity.name,
                    height: height
                });
                return;
            }
            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleScaleHeight] StretchY applied`, {
            height,
            appliedCount
        });
    }
    // ================== MoveY ==================
    _applyMoveY(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(this, '[RuleScaleHeight] No value for height', {
                    entityName: entity.name,
                    height: height
                });
                return;
            }
            SceneTransformHelper.setLocalPosition(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleScaleHeight] MoveY applied`, {
            height,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'ScaleHeight-UniSideShelves',
            watchAttributes: [
                'Height'
            ],
            priority: 20
        });
        this.context = context;
        // Твої дані з таблиці
        this.dataHeightSizeProduct = {
            stretch: MeshRuleConfigBuilder.create().breakpoints([
                56,
                53,
                50
            ]).meshes([
                'OpenSideShelvesMidWall',
                'OpenSideShelvesBackWall',
                'OpenSideShelvesSideWall'
            ]).values({
                56: {
                    y: 0
                },
                53: {
                    y: -0.03
                },
                50: {
                    y: -0.06
                }
            }).build(),
            move: MeshRuleConfigBuilder.create().breakpoints([
                56,
                53,
                50
            ]).meshes([
                'OpenSideShelves_Point'
            ]).values({
                56: {
                    y: 0
                },
                53: {
                    y: -0.015
                },
                50: {
                    y: -0.03
                }
            }).build()
        };
    }
}

export { RuleScaleHeightUniSideShelves };
