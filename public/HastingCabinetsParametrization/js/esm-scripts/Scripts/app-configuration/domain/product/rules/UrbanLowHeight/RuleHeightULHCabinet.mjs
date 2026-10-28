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
 */ class RuleHeightULHCabinet extends BaseProductRule {
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
        this._applyStretchY(height, this.dataHeightSizeProduct.stretchY);
        this._applyMoveY(height, this.dataHeightSizeProduct.moveY);
    // this._applyVisibility(height, this.dataHeightSizeProduct.visibility);
    }
    // ================== helpers ==================
    // _getValueForHeight(map, height) {
    //     if (!map) return undefined;
    //     // напряму числом
    //     if (Object.prototype.hasOwnProperty.call(map, height)) {
    //         return map[height];
    //     }
    //     // або ключі-строки
    //     const key = Object.keys(map).find(k => parseInt(k) === height);
    //     return key ? map[key] : undefined;
    // }
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
            name: 'Height-ULH-Cabinet',
            watchAttributes: [
                'Height'
            ],
            priority: 20
        });
        this.context = context;
        // Твої дані з таблиці
        this.dataHeightSizeProduct = {
            stretchY: MeshRuleConfigBuilder.create().meshes([
                "ULH_Drawer_HNoCut",
                "ULH_Drawer_HTopCut",
                "ULH_Cabinet_SCBackWall"
            ]).breakpoints([
                25,
                28,
                35,
                38
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0.06
                },
                35: {
                    y: 0.2
                },
                38: {
                    y: 0.26
                }
            }).meshes([
                "ULH_Drawer_BWall"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0
                },
                35: {
                    y: 0.095
                },
                38: {
                    y: 0.095
                }
            }).meshes([
                "ULH_Drawer_TopFraming"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0
                },
                35: {
                    y: 0.2
                },
                38: {
                    y: 0.2
                }
            }).meshes([
                "ULH_Cabinet_Walls"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0.03
                },
                35: {
                    y: 0.1
                },
                38: {
                    y: 0.13
                }
            }).meshes([
                "ULH_Drawer_SWall"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0
                },
                35: {
                    y: 0.157
                },
                38: {
                    y: 0.157
                }
            }).build(),
            moveY: MeshRuleConfigBuilder.create().breakpoints([
                25,
                28,
                35,
                38
            ]).meshes([
                "ULH_Cabinet_WallsPoint"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0.015
                },
                35: {
                    y: 0.05
                },
                38: {
                    y: 0.065
                }
            }).meshes([
                "ULH_Cabinet_Mount"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0.03
                },
                35: {
                    y: 0.1
                },
                38: {
                    y: 0.13
                }
            }).meshes([
                "ULH_Countertop_Point"
            ]).values({
                25: {
                    y: 0.25
                },
                28: {
                    y: 0.28
                },
                35: {
                    y: 0.35
                },
                38: {
                    y: 0.38
                }
            }).meshes([
                "ULH_Cabinet_HGroove",
                "ULH_Cabinet_HBracket"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0.03
                },
                35: {
                    y: 0.1
                },
                38: {
                    y: 0.13
                }
            }).meshes([
                "ULH_Drawer_Bolts"
            ]).values({
                25: {
                    y: 0
                },
                28: {
                    y: 0
                },
                35: {
                    y: 0.03
                },
                38: {
                    y: 0.03
                }
            }).build()
        };
    }
}

export { RuleHeightULHCabinet };
