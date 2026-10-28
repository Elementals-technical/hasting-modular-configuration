import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";
import { UF_HEIGHTS, ufHeightOf } from "../../logic/uf-cabinet-height-policy.mjs";

/** UF drawer count follows the guide height (NEW sheet A26:A29): 1D at 53 / 56 cm, 2D at 88 / 91 cm. */
export class RuleDrawersCabinetUrbanFreestanding extends BaseProductRule {
    constructor() {
        super({
            name: "RuleDrawersCabinetUrbanFreestanding",
            watchAttributes: ["Height"],
            priority: 40,
        });

        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(UF_HEIGHTS)
                .meshes(["UF_TopDrawer"])
                .values({
                    53: "Disable",
                    56: "Disable",
                    88: "Enable",
                    91: "Enable",
                })
                .build(),
        };
    }

    execute({ currentState }) {
        const height = ufHeightOf(currentState);
        const configuration = this.dataRule.visibility;

        if (height === null) {
            LoggerService.warn(this, "Unsupported Urban Freestanding cabinet height", {
                height: currentState.get("Height"),
            });
            return;
        }

        this._applyTransformConfig(height, configuration, (entity, value) =>
            SceneTransformHelper.setVisibleByState(entity, value),
        );
    }
}
