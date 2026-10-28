import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
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
        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value)=>SceneTransformHelper.setLocalPosition(entity, value));
    }
    constructor(){
        super({
            name: "RuleHeightCabinetClass",
            watchAttributes: [
                "Height"
            ],
            priority: 30
        });
        this.dataRule = {
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
