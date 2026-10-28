import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по висоті.
 *
 * Реагує на зміни атрибута 'Height' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними іменами.
 */ class RuleHeightCabinetMako extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleHeightCabinetMako] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const height = Number(currentState.get("Height"));
        if (height !== 26 && height !== 52) {
            LoggerService.warn(this, "Unsupported Mako cabinet height", {
                height
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleHeightCabinetMako] Executing for height: ${height}`, {
            previousHeight: previousState?.get("Height")
        });
        this._applyTransformConfig(height, this.dataRule.stretchY, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(height, this.dataRule.moveY, (entity, value)=>{
            SceneTransformHelper.setLocalPosition(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleHeightCabinetMako",
            watchAttributes: [
                "Height"
            ],
            priority: 30
        });
        this.dataRule = {
            stretchY: MeshRuleConfigBuilder.create().breakpoints([
                26,
                52
            ]).meshes([
                "CLMa_Cabinet_Walls"
            ]).values({
                26: {
                    y: -0.26
                },
                52: {
                    y: 0
                }
            }).build(),
            moveY: MeshRuleConfigBuilder.create().breakpoints([
                26,
                52
            ]).meshes([
                "CLMa_Cabinet_WallsPoint"
            ]).values({
                26: {
                    y: -0.13
                },
                52: {
                    y: 0
                }
            }).meshes([
                "Mako_Countertop_Point"
            ]).values({
                26: {
                    y: 0.26
                },
                52: {
                    y: 0.52
                }
            }).meshes([
                "Mako_Cabinet_HBracket"
            ]).values({
                26: {
                    y: -0.26
                },
                52: {
                    y: 0
                }
            }).meshes([
                "Mako_Top_Drawer"
            ]).values({
                26: {
                    y: -0.2605
                },
                52: {
                    y: 0
                }
            }).build()
        };
    }
}

export { RuleHeightCabinetMako };
