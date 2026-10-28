import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/** Initialize solid drawers and hide sink-only parts for Mako side cabinets. */ class RuleTypeSideCabinetMako extends BaseProductRule {
    shouldExecute() {
        return this.enabled && !this._applied;
    }
    async execute() {
        if (this._applied) return;
        // Hide available sink-only parts immediately, even while Boolean targets are still loading.
        const visibilityApplied = this._applyTransformConfig("side", this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        if (!visibilityApplied) return;
        this._applied = await this._applyBooleanConfig("side");
    }
    async _applyBooleanConfig(key) {
        const configuration = this.dataRule.boolean;
        const names = Object.keys(configuration.values);
        const targets = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(targets.map((entity)=>entity.name));
        if (names.some((name)=>!foundNames.has(name)) || targets.some((target)=>!target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh || configuration.values[target.name]?.[key] !== false)) {
            LoggerService.warn(this, "Mako drawer Boolean is not ready");
            return false;
        }
        await Promise.all(targets.map((target)=>SceneBooleanHelper.setEnabled(target, configuration.values[target.name][key], {
                immediate: true
            })));
        return targets.every((target)=>{
            const mb = target.script?.meshBoolean;
            return mb?.booleanEnabled === false && !!mb._sourceMesh && SceneEntityHelper.getMeshInstances(target)[0]?.mesh === mb._sourceMesh;
        });
    }
    constructor(){
        // Restore solid meshes before dimension and layout rules run.
        super({
            name: "RuleTypeSideCabinetMako",
            watchAttributes: [],
            priority: 5
        });
        this.dataRule = {
            visibility: {
                values: {
                    Mako_Top_DrawerBoolBox: {
                        side: "Disable"
                    },
                    Mako_Bot_DrawerFramingDD: {
                        side: "Disable"
                    },
                    Mako_Top_DrawerPlumFraming: {
                        side: "Disable"
                    }
                }
            },
            boolean: {
                values: {
                    Mako_Top_DrawerWalls: {
                        side: false
                    },
                    Mako_Bot_DrawerWalls: {
                        side: false
                    },
                    CLMa_Cabinet_Floor: {
                        side: false
                    }
                }
            }
        };
        this._applied = false;
    }
}

export { RuleTypeSideCabinetMako };
