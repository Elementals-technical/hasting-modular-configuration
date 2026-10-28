import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/** Restore the solid UF drawer mesh before dimensions and apply side cabinet visibility. */ class RuleTypeSideCabinetUrbanFreestanding extends BaseProductRule {
    shouldExecute() {
        return this.enabled && !this._applied;
    }
    async execute() {
        if (this._applied) return;
        const names = [
            ...new Set(Object.values(this.dataRule).flatMap((config)=>Object.keys(config.values)))
        ];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(entities.map((entity)=>entity.name));
        const missing = names.filter((name)=>!foundNames.has(name));
        if (missing.length) {
            LoggerService.warn(this, "UF side cabinet entities are missing", {
                entityNames: missing
            });
            return;
        }
        const targets = entities.filter((entity)=>entity.name in this.dataRule.boolean.values);
        if (targets.some((target)=>!target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh)) {
            LoggerService.warn(this, "UF drawer Boolean is not ready");
            return;
        }
        const visibilityApplied = this._applyTransformConfig("side", this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        if (!visibilityApplied) return;
        this._applied = await this._applyBooleanConfig("side");
    }
    async _applyBooleanConfig(key) {
        const configuration = this.dataRule.boolean;
        const names = Object.keys(configuration.values);
        const targets = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(targets.map((entity)=>entity.name));
        if (names.some((name)=>!foundNames.has(name)) || targets.some((entity)=>!entity.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh || configuration.values[entity.name]?.[key] !== false)) {
            LoggerService.warn(this, "UF side cabinet Boolean is not ready or configuration is invalid");
            return false;
        }
        await Promise.all(targets.map((target)=>SceneBooleanHelper.setEnabled(target, configuration.values[target.name][key], {
                immediate: true
            })));
        return targets.every((target)=>{
            const mb = target.script.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(target)[0]?.mesh;
            return mb.booleanEnabled === false && !!mb._sourceMesh && mesh === mb._sourceMesh;
        });
    }
    constructor(){
        super({
            name: "RuleTypeSideCabinetUrbanFreestanding",
            watchAttributes: [],
            priority: 5
        });
        this.dataRule = {
            visibility: {
                values: {
                    UF_TopDrawer_LowWalls: {
                        side: "Disable"
                    },
                    UF_TopDrawer_HighWalls: {
                        side: "Enable"
                    },
                    UF_Cabinet_SBBackWall: {
                        side: "Disable"
                    },
                    UF_Drawer_Framing: {
                        side: "Disable"
                    }
                }
            },
            boolean: {
                values: {
                    UF_TopDrawer_LowWalls: {
                        side: false
                    }
                }
            }
        };
        this._applied = false;
    }
}

export { RuleTypeSideCabinetUrbanFreestanding };
