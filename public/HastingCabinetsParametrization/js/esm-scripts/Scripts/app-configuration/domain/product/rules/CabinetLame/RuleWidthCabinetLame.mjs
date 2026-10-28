import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/**
 * Правило масштабування продукту по ширині.
 *
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними іменами.
 */ class RuleWidthCabinetLame extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthCabinetLame] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const width = Number(currentState.get("Width"));
        if (!this.dataRule.stretchX.breakpoints.includes(width)) {
            LoggerService.warn(this, "Unsupported Lame cabinet width", {
                width
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleWidthCabinetLame] Executing for width: ${width}`, {
            previousWidth: previousState?.get("Width")
        });
        this._applyTransformConfig(width, this.dataRule.stretchX, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleWidthCabinetLame",
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
                "Lame_Bot_Cabinet_Frame",
                "Lame_Cabinet_Floor",
                "Lame_Cabinet_Walls",
                "Lame_Top_Cabinet_Frame",
                "Lame_Bot_Drawer_Flut",
                "Lame_Bot_Drawer_Panel",
                "Lame_Bot_Drawer_Walls",
                "Lame_Top_Drawer_Flut",
                "Lame_Top_Drawer_Panel",
                "Lame_Top_Drawer_Walls"
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

export { RuleWidthCabinetLame };
