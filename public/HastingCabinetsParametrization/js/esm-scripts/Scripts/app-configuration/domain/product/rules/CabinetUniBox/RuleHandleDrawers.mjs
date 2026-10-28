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
 */ class RuleHandleDrawers extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDrawers] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const drawers = currentState.get('Drawers');
        this._applyVisibility(drawers, this.dataCabinetUUniBox.visibility);
        this._applyStretchY(drawers, this.dataCabinetUUniBox.stretch);
        this._applyMoveY(drawers, this.dataCabinetUUniBox.move);
    }
    // ================== Visibility ==================
    _applyVisibility(drawers, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            const value = configForMesh[drawers];
            if (!value) {
                LoggerService.log(this, '[RuleScaleHeight] No value for height', {
                    entityName: entity.name,
                    drawers: drawers
                });
                return;
            }
            SceneTransformHelper.setVisibleByState(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleScaleHeight] Visibility applied`, {
            drawers,
            appliedCount
        });
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
        entities.map((entity)=>{
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
            name: 'Visible-CabinetUniBox',
            watchAttributes: [
                "Drawers"
            ],
            priority: 30
        });
        this.context = context;
        // Твої дані з таблиці
        this.dataCabinetUUniBox = {
            visibility: MeshRuleConfigBuilder.meshes([
                'TopDrawer_Point'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Disable",
                '2D': "Enable",
                '1DWID': "Enable"
            }).meshes([
                'BotDrawerBoltsSD'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Enable",
                '2D': "Disable",
                '1DWID': "Enable"
            }).meshes([
                'BotDrawerBoltsDD'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Disable",
                '2D': "Enable",
                '1DWID': "Disable"
            }).meshes([
                'BotDrawerFramingSD'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Enable",
                '2D': "Disable",
                '1DWID': "Enable"
            }).meshes([
                'BotDrawerFramingDD',
                'CabinetFBotPlate'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Disable",
                '2D': "Enable",
                '1DWID': "Disable"
            }).meshes([
                'TopHandleMove_Point'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Disable",
                '2D': "Enable",
                '1DWID': "Disable"
            }).meshes([
                'TopDrawerInnerHandle_Point'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': "Enable",
                '2D': "Disable",
                '1DWID': "Enable"
            }).build(),
            stretch: MeshRuleConfigBuilder.meshes([
                'BotDrawerWalls'
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': {
                    y: 0.07
                },
                '2D': {
                    y: 0
                },
                '1DWID': {
                    y: 0.07
                }
            }).meshes([
                "HandleNoCut_Bot",
                "HandleTopCut_Bot"
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': {
                    y: 0.25
                },
                '2D': {
                    y: 0
                },
                '1DWID': {
                    y: 0.25
                }
            }).meshes([
                "TopDrawerWalls"
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': {
                    y: 0,
                    z: 0
                },
                '2D': {
                    y: 0,
                    z: 0
                },
                '1DWID': {
                    y: 0,
                    z: -0.018
                }
            }).meshes([
                "TopDrawerFloor"
            ]).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).values({
                '1D': {
                    z: 0
                },
                '2D': {
                    z: 0
                },
                '1DWID': {
                    z: -0.017
                }
            }).build(),
            move: MeshRuleConfigBuilder.create().breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).meshes([
                'BotDrawerWallsMove_Point'
            ]).values({
                '1D': {
                    y: 0.035
                },
                '2D': {
                    y: 0
                },
                '1DWID': {
                    y: 0.035
                }
            }).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).meshes([
                'BotHandleMove_Point'
            ]).values({
                '1D': {
                    y: 0.125
                },
                '2D': {
                    y: 0
                },
                '1DWID': {
                    y: 0.125
                }
            }).breakpoints([
                '1D',
                '2D',
                '1DWID'
            ]).meshes([
                'TopDrawerWallsMove_Point',
                'TopDrawerFloorMove_Point'
            ]).values({
                '1D': {
                    z: 0
                },
                '2D': {
                    z: 0
                },
                '1DWID': {
                    z: -73e-4
                }
            }).build()
        };
    }
}

export { RuleHandleDrawers };
