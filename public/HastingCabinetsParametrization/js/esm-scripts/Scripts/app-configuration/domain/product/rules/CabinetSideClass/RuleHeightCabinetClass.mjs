import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по висоті.
 *
 * Реагує на зміни атрибута 'Height' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */ class RuleHeightCabinetClass extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightCabinetClass] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));
        if (height !== 40 && height !== 52) {
            LoggerService.warn(this, "Unsupported Class cabinet height", {
                height
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleHeightCabinetClass] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height")
        });
        this._applyStretchY(height, this.dataHeightSizeProduct.stretchY);
        this._applyMoveY(height, this.dataHeightSizeProduct.moveY);
    // this._applyVisibility(height, this.dataHeightSizeProduct.visibility);
    }
    // ================== StretchY ==================
    _applyStretchY(height, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const entities = SceneEntityHelper.collectByNames(this.context.entity, Object.keys(cfg));
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            if (!configForMesh) {
                LoggerService.log(this, "[RuleHeightCabinetClass] No config for mesh name", {
                    entityName: entity.name
                });
                return;
            }
            const value = configForMesh[height];
            if (!value) {
                LoggerService.log(this, "[RuleHeightCabinetClass] No value for height", {
                    entityName: entity.name,
                    height: height
                });
                return;
            }
            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleHeightCabinetClass] StretchY applied`, {
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
                LoggerService.log(this, "[RuleHeightCabinetClass] No value for height", {
                    entityName: entity.name,
                    height: height
                });
                return;
            }
            SceneTransformHelper.setLocalPosition(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleHeightCabinetClass] MoveY applied`, {
            height,
            appliedCount
        });
    }
    constructor(){
        super({
            name: "RuleHeightCabinetClass",
            watchAttributes: [
                "Height"
            ],
            priority: 30
        });
        this.dataHeightSizeProduct = {
            stretchY: MeshRuleConfigBuilder.create().breakpoints([
                40,
                52
            ]).meshes([
                "CLMa_Cabinet_Walls"
            ]).values({
                40: {
                    y: -0.12
                },
                52: {
                    y: 0
                }
            }).build(),
            moveY: MeshRuleConfigBuilder.create().breakpoints([
                40,
                52
            ]).meshes([
                "CLMa_Cabinet_WallsPoint"
            ]).values({
                40: {
                    y: -0.06
                },
                52: {
                    y: 0
                }
            }).meshes([
                "Class_Countertop_Point"
            ]).values({
                40: {
                    y: 0.4
                },
                52: {
                    y: 0.52
                }
            }).build()
        };
    }
}

export { RuleHeightCabinetClass };
