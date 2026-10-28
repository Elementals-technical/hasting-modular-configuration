import { BaseProductRule } from '../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../helpers/scene-boolean-helper.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';

/** Side cabinets always have a solid Class top drawer floor. */
export class RuleTypeSideCabinetClass extends BaseProductRule {
    constructor() {
        // Disable cuts before visibility, dimensions and layout are applied.
        super({ name: 'RuleTypeSideCabinetClass', watchAttributes: [], priority: 5 });
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

        // Restore once before the dimension rules; no debounce/frame delay is
        // needed to disable a cut. Later SmartStretch updates use the solid mesh.
        await Promise.all(targets.map(target =>
            SceneBooleanHelper.setEnabled(target, false, { immediate: true })));

        this._applied = targets.every(target => {
            const mb = target.script?.meshBoolean;
            return mb?.booleanEnabled === false && !!mb._sourceMesh &&
                SceneEntityHelper.getMeshInstances(target)[0]?.mesh === mb._sourceMesh;
        });
    }
}
