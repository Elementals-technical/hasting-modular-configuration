import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/**
 * Controls Mako handle visibility for G57 and G50 styles.
 */
export class RuleHandleCabinetMako extends BaseProductRule {
    constructor() {
        super({
            name: "RuleHandleCabinetMako",
            watchAttributes: ["HandleStyle"],
            priority: 45,
        });

        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(["G57", "G50"])
                .meshes(["Mako_Top_Handle_G57", "Mako_Bot_Handle_G57"])
                .values({
                    G57: "Enable",
                    G50: "Disable",
                })
                .meshes([
                    "Mako_Bot_Handle_StonesG50",
                    "Mako_Bot_Handle_Base",
                    "Mako_Top_Handle_StonesG50",
                    "Mako_Top_Handle_BaseG50",
                ])
                .values({
                    G57: "Disable",
                    G50: "Enable",
                })
                .build(),
        };
    }

    onInitialize() {
        LoggerService.log(this, `📏 [RuleHandleCabinetMako] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const handleStyle = currentState.get("HandleStyle") ?? "G57";

        if (!this.dataRule.visibility.breakpoints.includes(handleStyle)) {
            LoggerService.warn(this, "Unsupported Mako cabinet handle style", {
                productId: this.productId,
                handleStyle,
            });
            return;
        }

        LoggerService.log(this, "Applying Mako cabinet handle style", {
            handleStyle,
            previousHandleStyle: previousState?.get("HandleStyle"),
        });

        this._applyTransformConfig(handleStyle, this.dataRule.visibility, (entity, value) => {
            SceneTransformHelper.setVisibleByState(entity, value);
        });
    }

}
