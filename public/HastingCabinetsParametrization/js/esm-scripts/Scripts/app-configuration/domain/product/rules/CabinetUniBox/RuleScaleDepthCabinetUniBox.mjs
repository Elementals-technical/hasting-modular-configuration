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
 */ class RuleScaleDepthCabinetUniBox extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const depth = currentState.get('Depth');
        LoggerService.log(this, `📏 [RuleScaleDepth] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get('Depth')
        });
        if (Number.isNaN(depth)) {
            LoggerService.log(this, '⚠️ [RuleScaleDepth] depth is NaN, skip');
            return;
        }
        this._applyStretch(depth, this.dataHeightSizeProduct.stretch);
        this._applyMove(depth, this.dataHeightSizeProduct.move);
    }
    // ================== Stretch ==================
    _applyStretch(depth, entitiesByName) {
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
            const value = configForMesh[depth];
            if (!value) {
                LoggerService.log(this, '[RuleScaleDepth] No value for depth', {
                    entityName: entity.name,
                    depth: depth
                });
                return;
            }
            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleScaleDepth] Stretch applied`, {
            depth,
            appliedCount
        });
    }
    // ================== Move ==================
    _applyMove(depth, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            const value = configForMesh[depth];
            if (!value) {
                LoggerService.log(this, '[RuleScaleDepth] No value for depth', {
                    entityName: entity.name,
                    depth: depth
                });
                return;
            }
            SceneTransformHelper.setLocalPosition(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleScaleDepth] Move applied`, {
            depth,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'ScaleDepth-CabinetUniBox',
            watchAttributes: [
                'Depth'
            ],
            priority: 30
        });
        this.context = context;
        // Твої дані з таблиці
        this.dataHeightSizeProduct = {
            stretch: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50.5
            ]).meshes([
                'CabinetUniBody',
                'BotDrawerWalls',
                'TopDrawerWalls',
                "BotDrawerFloor",
                "TopDrawerFloor",
                "TopDrawerHinge",
                "BotDrawerHinge",
                "CabinetFBotPlate",
                "SolidCountertopM"
            ]).values({
                46: {
                    z: 0
                },
                50.5: {
                    z: 0.045
                }
            }).build(),
            move: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50.5
            ]).meshes([
                'CabinetMove_Point',
                "CabinetBackWallMove_Point",
                "CabinetHideWallMove_Point"
            ]).values({
                46: {
                    z: 0
                },
                50.5: {
                    z: 0.0225
                }
            }).meshes([
                'TopDrawerWallsMove_Point',
                'BotDrawerWallsMove_Point',
                'TopDrawerHingeMove_Point',
                'BotDrawerHingeMove_Point',
                'BotDrawerFloorMove_Point',
                'TopDrawerFloorMove_Point'
            ]).values({
                46: {
                    z: 0
                },
                50.5: {
                    z: 0.0225
                }
            }).meshes([
                'TopHandleMove_Point',
                'BotHandleMove_Point'
            ]).values({
                46: {
                    z: 0
                },
                50.5: {
                    z: 0.044
                }
            }).meshes([
                'CabinetFBotPlateMove_Point'
            ]).values({
                46: {
                    z: 0
                },
                50.5: {
                    z: 0.044
                }
            }).meshes([
                'CabinetFTopPlateMove_Point'
            ]).values({
                46: {
                    z: 0
                },
                50.5: {
                    z: 0.044
                }
            }).build()
        };
    }
}

export { RuleScaleDepthCabinetUniBox };
