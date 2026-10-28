import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/** Lame drawer mode controls the bottom drawer and bottom cabinet frame. */
export class RuleDrawersCabinetLame extends BaseProductRule {
    constructor() {
        super({
            name: "RuleDrawersCabinetLame",
            watchAttributes: ["Drawers"],
            priority: 40,
        });

        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(["2D", "1D"])
                .meshes(["Lame_BotDrawer", "Lame_Bot_Cabinet_Frame"])
                .values({
                    "2D": "Enable",
                    "1D": "Disable",
                })
                .build(),
        };
    }

    execute({ currentState }) {
        const drawers = currentState.get("Drawers");
        const configuration = this.dataRule.visibility;

        if (!configuration.breakpoints.includes(drawers)) {
            LoggerService.warn(this, "Unsupported Lame drawer mode", { drawers });
            return;
        }

        this._applyTransformConfig(drawers, configuration, (entity, value) =>
            SceneTransformHelper.setVisibleByState(entity, value),
        );
    }
}
