import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/** Side cabinets always have a solid Class top drawer floor. */ class RuleTypeSideCabinetClass extends BaseProductRule {
    shouldExecute() {
        return this.enabled && !this._applied;
    }
    async execute() {
        if (this._applied) return;
        this._applied = await this._applyBooleanConfig('side');
    }
    async _applyBooleanConfig(key) {
        const configuration = this.dataRule.boolean;
        const names = Object.keys(configuration.values);
        const root = this.context.entity;
        const targets = SceneEntityHelper.collectByNames(root, names);
        const foundNames = new Set(targets.map((target)=>target.name));
        if (names.some((name)=>!foundNames.has(name))) {
            LoggerService.warn(this, 'Class_Top_Drawer_Floor is missing in the product');
            return false;
        }
        // Do not mark initialization complete while the template is incomplete.
        if (targets.some((target)=>!target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh || configuration.values[target.name]?.[key] !== false)) {
            LoggerService.warn(this, 'Class top drawer Boolean is not ready');
            return false;
        }
        // Restore once before the dimension rules; no debounce/frame delay is
        // needed to disable a cut. Later SmartStretch updates use the solid mesh.
        await Promise.all(targets.map((target)=>SceneBooleanHelper.setEnabled(target, configuration.values[target.name][key], {
                immediate: true
            })));
        return targets.every((target)=>{
            const mb = target.script?.meshBoolean;
            return mb?.booleanEnabled === false && !!mb._sourceMesh && SceneEntityHelper.getMeshInstances(target)[0]?.mesh === mb._sourceMesh;
        });
    }
    constructor(){
        // Disable cuts before visibility, dimensions and layout are applied.
        super({
            name: 'RuleTypeSideCabinetClass',
            watchAttributes: [],
            priority: 5
        });
        this._applied = false;
        this.dataRule = {
            boolean: {
                values: {
                    Class_Top_Drawer_Floor: {
                        side: false
                    }
                }
            }
        };
    }
}

export { RuleTypeSideCabinetClass };
