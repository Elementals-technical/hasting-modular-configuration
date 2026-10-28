import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { OperationType } from '../../../../../../mesh-boolean/core/MeshBooleanOperation.mjs';

/** Initialize the Class sink cabinet's top drawer cut once per product. */ class RuleTypeSinkCabinetClass extends BaseProductRule {
    shouldExecute() {
        return this.enabled && !this._applied;
    }
    async execute() {
        if (this._applied) return;
        this._applied = await this._applyBooleanConfig('sink');
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
        if (targets.some((target)=>!target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh || configuration.values[target.name]?.[key] !== true)) {
            LoggerService.warn(this, 'Class top drawer Boolean is not ready');
            return false;
        }
        // Resolve the cutter from this product, not a reference to the template.
        const cutters = SceneEntityHelper.collectByNames(root, [
            this.cutterName
        ]);
        if (cutters.length !== 1 || !SceneEntityHelper.getMeshInstances(cutters[0])[0]?.mesh) {
            LoggerService.warn(this, 'Expected one ready Class_Top_Drawer_BoolB in the product');
            return false;
        }
        // Coalesce pending stretch requests into the final cut after layout.
        // SmartStretch remains responsible for subsequent dimension rebuilds.
        await Promise.all(targets.map((target)=>SceneBooleanHelper.configure(target, {
                enabled: configuration.values[target.name][key],
                cutters,
                operation: OperationType.SUBTRACT
            }, {
                debounceMs: 0,
                delayFrames: 2
            })));
        return targets.every((target)=>{
            const mb = target.script?.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(target)[0]?.mesh;
            return mb?.booleanEnabled === true && !!mb._sourceMesh && !!mesh && mesh !== mb._sourceMesh && (!cutters[0].parent || cutters[0].parent.enabled);
        });
    }
    constructor(){
        // Cut after visibility, dimensions and drawer layout are applied.
        super({
            name: 'RuleTypeSinkCabinetClass',
            watchAttributes: [],
            priority: 60
        });
        this._applied = false;
        this.dataRule = {
            boolean: {
                values: {
                    Class_Top_Drawer_Floor: {
                        sink: true
                    }
                }
            }
        };
        this.cutterName = 'Class_Top_Drawer_BoolB';
    }
}

export { RuleTypeSinkCabinetClass };
