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
/**
 * Drawer layout: which drawers, groove and handles EXIST. Which handle style is shown is
 * RuleHandleCabinetUrbanDuplex's decision (as in Urban Standard: RuleHandleDrawers hides the top-handle
 * point, RuleHandleVisibility picks the handle inside it).
 */ class RuleDrawersCabinetUrbanDuplex extends BaseProductRule {
    execute({ currentState }) {
        const configuredDrawers = currentState.get("Drawers");
        const drawers = configuredDrawers === undefined ? "2D" : configuredDrawers;
        const options = RuleDrawersCabinetUrbanDuplex.attributeOptions.Drawers;
        if (!options.includes(drawers)) {
            console.warn(`[${this.name}] Invalid Drawers. Allowed values: ${options.join(", ")}`, {
                productId: this.productId,
                value: drawers
            });
            return;
        }
        this._applyTransformConfig(drawers, this.dataRule.visibility, (entity, value)=>{
            SceneTransformHelper.setVisibleByState(entity, value);
        });
        if (this.dataRule.topHandleVisibility.breakpoints.includes(drawers)) {
            this._applyTransformConfig(drawers, this.dataRule.topHandleVisibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        }
    }
    constructor(){
        super({
            name: "RuleDrawersCabinetUrbanDuplex",
            watchAttributes: [
                "Drawers",
                "HandleStyle"
            ],
            priority: 46
        });
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create().breakpoints(RuleDrawersCabinetUrbanDuplex.attributeOptions.Drawers).meshes([
                "UD_TopDrawer"
            ]).values({
                "2D": "Enable",
                "1DWID": "Enable",
                "1D": "Disable"
            }).meshes([
                "UD_Cabinet_HGroove_Bot"
            ]).values({
                "2D": "Enable",
                "1DWID": "Disable",
                "1D": "Disable"
            }).build(),
            // In 1D these handles retain the state applied by the handle-style rule.
            topHandleVisibility: MeshRuleConfigBuilder.create().breakpoints([
                "2D",
                "1DWID"
            ]).meshes([
                "UD_Handle_BaseP_Top",
                "UD_Handle_LateralP_Top"
            ]).values({
                "2D": "Enable",
                "1DWID": "Disable"
            }).meshes([
                "UD_Handle_Inner_Top"
            ]).values({
                "2D": "Disable",
                "1DWID": "Enable"
            }).build()
        };
    }
}
_define_property(RuleDrawersCabinetUrbanDuplex, "attributeOptions", Object.freeze({
    Drawers: Object.freeze([
        "2D",
        "1DWID",
        "1D"
    ])
}));
/** Does the top drawer have an outer handle: 2D yes, 1DWID no (the inner handle instead), 1D — no top drawer, leave as is. */ _define_property(RuleDrawersCabinetUrbanDuplex, "topHandleExistsFor", Object.freeze({
    "2D": true,
    "1DWID": false
}));

export { RuleDrawersCabinetUrbanDuplex };
