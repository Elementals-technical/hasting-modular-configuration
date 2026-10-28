import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/** Urban Freestanding width: stretch and local positions from the size tables. */ class RuleWidthCabinetUrbanFreestanding extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleWidthCabinetUrbanFreestanding] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const width = Number(currentState.get("Width"));
        if (!this.dataRule.stretchX.breakpoints.includes(width)) {
            LoggerService.warn(this, "Unsupported UrbanFreestanding cabinet width", {
                width
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleWidthCabinetUrbanFreestanding] Executing for width: ${width}`, {
            previousWidth: previousState?.get("Width")
        });
        this._applyTransformConfig(width, this.dataRule.stretchX, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleWidthCabinetUrbanFreestanding",
            watchAttributes: [
                "Width"
            ],
            priority: 20
        });
        this.dataRule = {
            stretchX: MeshRuleConfigBuilder.create().breakpoints([
                25,
                35,
                40,
                50,
                60,
                70,
                80,
                90,
                100,
                105,
                120
            ]).meshes([
                "UF_Cabinet_HBracket",
                "UF_Cabinet_HGroove_Top",
                "UF_Cabinet_Mount",
                "UF_Cabinet_SBBackWall",
                "UF_HandleBotCut_Top",
                "UF_HandleNoCut_Top",
                "UF_HandleTopCut_Top",
                "UF_HandleNoCut_Bot",
                "UF_HandleTopCut_Bot",
                "UF_BotDrawer_Hinge",
                "UF_BotDrawer_Walls",
                "UF_TopDrawer_Hinge",
                "UF_TopDrawer_HighWalls",
                "UF_TopDrawer_LowWalls",
                "UF_Cabinet_Walls",
                "UF_Cabinet_HGroove_Bot",
                "UF_Overlay_BotCut_Top",
                "UF_Overlay_NoCut_Top",
                "UF_Overlay_TopCut_Top",
                "UF_Overlay_NoCut_Bot",
                "UF_Overlay_TopCut_Bot"
            ]).values({
                25: {
                    x: -0.35
                },
                35: {
                    x: -0.25
                },
                40: {
                    x: -0.2
                },
                50: {
                    x: -0.1
                },
                60: {
                    x: 0
                },
                70: {
                    x: 0.1
                },
                80: {
                    x: 0.2
                },
                90: {
                    x: 0.3
                },
                100: {
                    x: 0.4
                },
                105: {
                    x: 0.45
                },
                120: {
                    x: 0.6
                }
            }).build()
        };
    }
}

export { RuleWidthCabinetUrbanFreestanding };
