import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { UF_DEPTHS } from '../../registry/CabinetUrbanFreestanding/UFConfig.mjs';

/** Urban Freestanding depth: stretch and local positions for the price list depths 46 / 50; values: NEW sheet A30:D32, A45:G47. */ class RuleDepthCabinetUrbanFreestanding extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDepthCabinetUrbanFreestanding] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const depth = Number(currentState.get("Depth"));
        if (!this.dataRule.stretchZ.breakpoints.includes(depth)) {
            LoggerService.warn(this, "Unsupported UrbanFreestanding cabinet depth", {
                depth
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleDepthCabinetUrbanFreestanding] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get("Depth")
        });
        this._applyTransformConfig(depth, this.dataRule.stretchZ, (entity, value)=>{
            SceneTransformHelper.setStretch(entity, value);
        });
        this._applyTransformConfig(depth, this.dataRule.moveZ, (entity, value)=>{
            SceneTransformHelper.setLocalPosition(entity, value);
        });
    }
    constructor(){
        super({
            name: "RuleDepthCabinetUrbanFreestanding",
            watchAttributes: [
                "Depth"
            ],
            priority: 35
        });
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create().breakpoints(UF_DEPTHS).meshes([
                "UF_BotDrawer_Hinge",
                "UF_BotDrawer_Walls",
                "UF_TopDrawer_Hinge",
                "UF_TopDrawer_HighWalls",
                "UF_TopDrawer_LowWalls",
                "UF_Cabinet_Walls"
            ]).values({
                46: {
                    z: -0.04
                },
                50: {
                    z: 0
                }
            }).build(),
            // UF_Cabinet_Mount (NEW sheet F37/F46) is not moved in Z: it sits at the cabinet back (v69 mesh z 0-0.105), which stays put.
            moveZ: MeshRuleConfigBuilder.create().breakpoints(UF_DEPTHS).meshes([
                "UF_Cabinet_HGroove_Top",
                "UF_Cabinet_HGroove_Bot_Point",
                "UF_BotDrawer",
                "UF_Cabinet_HBracket",
                "UF_TopDrawer"
            ]).values({
                46: {
                    z: -0.04
                },
                50: {
                    z: 0
                }
            }).meshes([
                "UF_TopDrawer_Walls_Point",
                "UF_TopDrawer_Hinge_Point",
                "UF_BotDrawer_Walls_Point",
                "UF_BotDrawer_Hinge_Point"
            ]).values({
                46: {
                    z: 0.02
                },
                50: {
                    z: 0
                }
            }).meshes([
                "UF_Drawer_Framing",
                "UF_TopDrawer_BoolBox"
            ]).values({
                46: {
                    z: 0.04
                },
                50: {
                    z: 0
                }
            }).meshes([
                "UF_Cabinet_Walls_Point"
            ]).values({
                46: {
                    z: -0.02
                },
                50: {
                    z: 0
                }
            }).build()
        };
    }
}

export { RuleDepthCabinetUrbanFreestanding };
