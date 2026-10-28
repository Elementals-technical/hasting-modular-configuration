import { BaseProductRule } from '../base-product-rule.mjs';
import { MeshRuleConfigBuilder } from '../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/** Urban Duplex handle visibility follows the Duplex / Default style table. */ class RuleHandleCabinetUrbanDuplex extends BaseProductRule {
    /** The configured style; unset means 'Duplex' (the product default). */ static handleStyleOf(currentState) {
        const configuredStyle = currentState.get("HandleStyle");
        return configuredStyle === undefined ? "Duplex" : configuredStyle;
    }
    execute({ currentState }) {
        const handleStyle = RuleHandleCabinetUrbanDuplex.handleStyleOf(currentState);
        const options = RuleHandleCabinetUrbanDuplex.attributeOptions.HandleStyle;
        if (!options.includes(handleStyle)) {
            console.warn(`[${this.name}] Invalid HandleStyle. Allowed values: ${options.join(", ")}`, {
                productId: this.productId,
                value: handleStyle
            });
        } else {
            this._applyTransformConfig(handleStyle, this.dataRule.visibility, (entity, value)=>{
                SceneTransformHelper.setVisibleByState(entity, value);
            });
        }
    }
    constructor(){
        super({
            name: "RuleHandleCabinetUrbanDuplex",
            watchAttributes: [
                "HandleStyle"
            ],
            priority: 45
        });
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create().breakpoints(RuleHandleCabinetUrbanDuplex.attributeOptions.HandleStyle).meshes([
                "UD_Handle_Full_Top",
                "UD_Handle_Full_Bot"
            ]).values({
                Duplex: "Disable",
                Default: "Enable"
            }).meshes([
                "UD_Handle_BaseP_Top",
                "UD_Handle_LateralP_Top",
                "UD_Handle_BaseP_Bot",
                "UD_Handle_LateralP_Bot"
            ]).values({
                Duplex: "Enable",
                Default: "Disable"
            }).build()
        };
    }
}
_define_property(RuleHandleCabinetUrbanDuplex, "attributeOptions", Object.freeze({
    HandleStyle: Object.freeze([
        "Duplex",
        "Default"
    ])
}));
/** Top-drawer handle meshes of each style. RuleDrawersCabinetUrbanDuplex decides whether the top handle exists. */ _define_property(RuleHandleCabinetUrbanDuplex, "topHandleMeshesByStyle", Object.freeze({
    Duplex: Object.freeze([
        "UD_Handle_BaseP_Top",
        "UD_Handle_LateralP_Top"
    ]),
    Default: Object.freeze([
        "UD_Handle_Full_Top"
    ])
}));

export { RuleHandleCabinetUrbanDuplex };
