import { BaseProductRule } from '../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../helpers/scene-boolean-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { OperationType } from '../../../../../mesh-boolean/core/MeshBooleanOperation.mjs';

/** Initialize the Class sink cabinet's top drawer cut once per product. */
export class RuleTypeSinkCabinetClass extends BaseProductRule {
    constructor() {
        // Cut after visibility, dimensions and drawer layout are applied.
        super({ name: 'RuleTypeSinkCabinetClass', watchAttributes: [], priority: 60 });
        this._applied = false;
    }

    shouldExecute() {
        return this.enabled && !this._applied;
    }

    async execute() {
        if (this._applied) return;
        const root = this.context.entity;
        const targets = SceneEntityHelper.collectByNames(root, ['Class_Top_Drawer_Floor']);
        if (targets.length === 0) {
            LoggerService.warn(this, 'Class_Top_Drawer_Floor is missing in the product');
            return;
        }
        // Do not mark initialization complete while the template is incomplete.
        if (targets.some(target => !target.script?.meshBoolean ||
            !SceneEntityHelper.getMeshInstances(target)[0]?.mesh)) {
            LoggerService.warn(this, 'Class top drawer Boolean is not ready');
            return;
        }

        // Resolve the cutter from this product, not a reference to the template.
        const cutters = SceneEntityHelper.collectByNames(root, ['Class_Top_Drawer_BoolB']);
        if (cutters.length !== 1 || !SceneEntityHelper.getMeshInstances(cutters[0])[0]?.mesh) {
            LoggerService.warn(this, 'Expected one ready Class_Top_Drawer_BoolB in the product');
            return;
        }

        // Coalesce pending stretch requests into the final cut after layout.
        // SmartStretch remains responsible for subsequent dimension rebuilds.
        await Promise.all(targets.map(target =>
            SceneBooleanHelper.configure(target, {
                enabled: true,
                cutters,
                operation: OperationType.SUBTRACT
            }, { debounceMs: 0, delayFrames: 2 })));

        this._applied = targets.every(target => {
            const mb = target.script?.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(target)[0]?.mesh;
            return mb?.booleanEnabled === true && !!mb._sourceMesh && !!mesh &&
                mesh !== mb._sourceMesh && (!cutters[0].parent || cutters[0].parent.enabled);
        });
    }
}
