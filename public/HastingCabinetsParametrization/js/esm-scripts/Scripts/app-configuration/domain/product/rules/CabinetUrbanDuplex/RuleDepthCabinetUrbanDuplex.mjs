import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

/** Urban Duplex depth: stretch and local positions from the size tables. */ class RuleDepthCabinetUrbanDuplex extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleDepthCabinetUrbanDuplex] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        const depth = Number(currentState.get("Depth"));
        if (!this.dataRule.stretchZ.breakpoints.includes(depth)) {
            LoggerService.warn(this, "Unsupported UrbanDuplex cabinet depth", {
                depth
            });
            return;
        }
        LoggerService.log(this, `📏 [RuleDepthCabinetUrbanDuplex] Executing for depth: ${depth}`, {
            previousDepth: previousState?.get("Depth")
        });
        this._applyTransformConfig(depth, this.dataRule.stretchZ, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
        this._applyTransformConfig(depth, this.dataRule.moveZ, (entity, value)=>SceneTransformHelper.setLocalPosition(entity, value));
    }
    constructor(){
        super({
            name: "RuleDepthCabinetUrbanDuplex",
            watchAttributes: [
                "Depth"
            ],
            priority: 35
        });
        this.dataRule = {
            stretchZ: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50
            ]).meshes([
                "UD_Cabinet_Walls",
                "UD_TopDrawer_Walls",
                "UD_TopDrawer_Hinge",
                "UD_BotDrawer_High_Walls",
                "UD_BotDrawer_Hinge"
            ]).values({
                46: {
                    z: 0
                },
                50: {
                    z: 0.045
                }
            }).build(),
            moveZ: MeshRuleConfigBuilder.create().breakpoints([
                46,
                50
            ]).meshes([
                "UD_Cabinet_Walls_Point",
                "UD_TopDrawer_Walls_Point",
                "UD_TopDrawer_Hinge_Point",
                "UD_BotDrawer_Walls_Point",
                "UD_BotDrawer_Hinge_Point"
            ]).values({
                46: {
                    z: 0
                },
                50: {
                    z: 0.0225
                }
            }).meshes([
                "UD_Handle_BaseP_Bot_Point",
                "UD_Handle_LateralP_Bot_Point",
                "UD_Handle_Full_Bot_Point",
                "UD_Cabinet_HGroove_Top",
                "UD_Handle_LateralP_Top_Point",
                "UD_Handle_BaseP_Top_Point",
                "UD_Handle_Full_Top_Point",
                "UD_Handle_Inner_Top",
                "UD_Cabinet_HGroove_Bot"
            ]).values({
                46: {
                    z: 0
                },
                50: {
                    z: 0.045
                }
            }).build()
        };
    }
}

export { RuleDepthCabinetUrbanDuplex };
