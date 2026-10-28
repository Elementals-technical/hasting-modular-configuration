import { BaseProductRule } from "../base-product-rule.mjs";
import { LoggerService } from "../../../../services/logger/logger-service.mjs";
import { MeshRuleConfigBuilder } from "../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneTransformHelper } from "../../../../helpers/scene-transform-helper.mjs";

/** Urban Duplex handle visibility follows the Duplex / Default style table. */
export class RuleHandleCabinetUrbanDuplex extends BaseProductRule {
    static attributeOptions = Object.freeze({
        HandleStyle: Object.freeze(["Duplex", "Default"]),
    });

    /** Top-drawer handle meshes of each style. RuleDrawersCabinetUrbanDuplex decides whether the top handle exists. */
    static topHandleMeshesByStyle = Object.freeze({
        Duplex: Object.freeze(["UD_Handle_BaseP_Top", "UD_Handle_LateralP_Top"]),
        Default: Object.freeze(["UD_Handle_Full_Top"]),
    });

    /** The configured style; unset means 'Duplex' (the product default). */
    static handleStyleOf(currentState) {
        const configuredStyle = currentState.get("HandleStyle");
        return configuredStyle === undefined ? "Duplex" : configuredStyle;
    }

    constructor() {
        super({
            name: "RuleHandleCabinetUrbanDuplex",
            watchAttributes: ["HandleStyle"],
            priority: 45,
        });

        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(RuleHandleCabinetUrbanDuplex.attributeOptions.HandleStyle)
                .meshes(["UD_Handle_Full_Top", "UD_Handle_Full_Bot"])
                .values({ Duplex: "Disable", Default: "Enable" })
                .meshes([
                    "UD_Handle_BaseP_Top",
                    "UD_Handle_LateralP_Top",
                    "UD_Handle_BaseP_Bot",
                    "UD_Handle_LateralP_Bot",
                ])
                .values({ Duplex: "Enable", Default: "Disable" })
                .build(),
        };
    }

    execute({ currentState }) {
        const handleStyle = RuleHandleCabinetUrbanDuplex.handleStyleOf(currentState);

        const options = RuleHandleCabinetUrbanDuplex.attributeOptions.HandleStyle;
        if (!options.includes(handleStyle)) {
            console.warn(`[${this.name}] Invalid HandleStyle. Allowed values: ${options.join(", ")}`, {
                productId: this.productId,
                value: handleStyle,
            });
        } else {
            this._applyTransformConfig(handleStyle, this.dataRule.visibility, (entity, value) => {
                SceneTransformHelper.setVisibleByState(entity, value);
            });
        }

    }

}
