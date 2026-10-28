import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/**
 * Controls Mako cabinet leg visibility.
 */
export class RuleLegsCabinetMako extends BaseProductRule {
    constructor() {
        super({
            name: "RuleLegsCabinetMako",
            watchAttributes: ["ShowLegs"],
            priority: 55,
        });

        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(["Enable", "Disable"])
                .meshes(["Mako_Cabinet_M_Legs"])
                .values({
                    Enable: "Enable",
                    Disable: "Disable",
                })
                .build(),
        };
    }


    onInitialize() {
        LoggerService.log(this, `📏 [RuleLegsCabinetMako] Initialized for product "${this.productId}"`);
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState, previousState }) {
        const legs = currentState.get("ShowLegs") ?? "Enable";

        if (!this.dataRule.visibility.breakpoints.includes(legs)) {
            LoggerService.warn(this, "Unsupported Mako cabinet legs state", {
                productId: this.productId,
                legs,
            });
            return;
        }

        LoggerService.log(this, "Applying Mako cabinet legs state", {
            legs,
            previousShowLegs: previousState?.get("ShowLegs"),
        });

        this._applyTransformConfig(legs, this.dataRule.visibility, (entity, value) => {
            SceneTransformHelper.setVisibleByState(entity, value);
        });
    }

}
