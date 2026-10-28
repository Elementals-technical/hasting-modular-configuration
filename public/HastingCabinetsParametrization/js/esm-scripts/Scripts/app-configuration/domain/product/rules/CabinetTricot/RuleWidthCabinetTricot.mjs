import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 *
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними іменами.
 */ class RuleWidthCabinetTricot extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthCabinetTricot] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const width = Number(currentState.get("Width"));
        if (!this.dataRule.stretchX.breakpoints.includes(width)) {
            LoggerService.warn(this, "Unsupported Tricot cabinet width", {
                width
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleWidthCabinetTricot] Executing for width: ${width}`, {
            previousWidth: previousState?.get("Width")
        });
        this._applyTransformConfig(width, this.dataRule.stretchX, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleWidthCabinetTricot",
            watchAttributes: [
                "Width"
            ],
            priority: 20
        });
        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.create().breakpoints([
                40,
                60,
                80,
                100,
                120
            ]).meshes([
                "Tricot_Cabinet_Floor",
                "Tricot_Cabinet_HGroove_Bot",
                "Tricot_Cabinet_HGroove_Top",
                "CLMa_Cabinet_Walls",
                "Tricot_Top_Drawer_Floor",
                "Tricot_Top_Drawer_Framing",
                "Tricot_Top_Drawer_Handle",
                "Tricot_Top_Drawer_HandleInner",
                "Tricot_Top_Drawer_Handle_Flut",
                "Tricot_Top_Drawer_HandleCutout",
                "Tricot_Top_Drawer_Hinge",
                "Tricot_Bot_Drawer_Floor",
                "Tricot_Bot_Drawer_Handle",
                "Tricot_Bot_Drawer_Handle_Flut",
                "Tricot_Bot_Drawer_HandleCutout",
                "Tricot_Bot_Drawer_Hinge"
            ]).values({
                40: {
                    x: -0.2
                },
                60: {
                    x: 0
                },
                80: {
                    x: 0.2
                },
                100: {
                    x: 0.4
                },
                120: {
                    x: 0.6
                }
            }).build()
        };
    }
}

export { RuleWidthCabinetTricot };
