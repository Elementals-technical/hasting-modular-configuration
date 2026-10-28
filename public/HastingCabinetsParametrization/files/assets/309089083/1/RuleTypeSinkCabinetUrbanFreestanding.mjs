import { BaseProductRule } from "../../base-product-rule.mjs";
import { SceneEntityHelper } from "../../../../../helpers/scene-entity-helper.mjs";
import { SceneBooleanHelper } from "../../../../../helpers/scene-boolean-helper.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";
import { OperationType } from "../../../../../../mesh-boolean/core/MeshBooleanOperation.mjs";

/** Apply UF sink visibility and drawer cut after dimensions and drawer layout. */
export class RuleTypeSinkCabinetUrbanFreestanding extends BaseProductRule {
    constructor() {
        super({ name: "RuleTypeSinkCabinetUrbanFreestanding", watchAttributes: ["Width", "Height", "Depth"], priority: 60 });
        this.dataRule = {
            visibility: { values: {
                UF_TopDrawer_LowWalls: { sink: "Enable" },
                UF_TopDrawer_HighWalls: { sink: "Disable" },
                UF_Cabinet_SBBackWall: { sink: "Enable" },
                UF_Drawer_Framing: { sink: "Enable" },
            } },
            boolean: { values: { UF_TopDrawer_LowWalls: { sink: true } } },
        };
        this._applied = false;
    }

    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._applied || super.shouldExecute(changes, currentState, previousState));
    }

    async execute() {
        this._applied = false;
        const names = [...new Set(Object.values(this.dataRule).flatMap(config => Object.keys(config.values)))];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(entities.map(entity => entity.name));
        const missing = names.filter(name => !foundNames.has(name));
        if (missing.length) {
            LoggerService.warn(this, "UF sink cabinet entities are missing", { entityNames: missing });
            return;
        }
        const targets = entities.filter(entity => entity.name in this.dataRule.boolean.values);
        if (targets.some(target => !target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh)) {
            LoggerService.warn(this, "UF drawer Boolean is not ready");
            return;
        }
        // Resolve the cutter from this product instance, never the template.
        const cutters = SceneEntityHelper.collectByNames(this.entity, ["UF_TopDrawer_BoolBox"]);
        if (cutters.length !== 1 || !SceneEntityHelper.getMeshInstances(cutters[0])[0]?.mesh) {
            LoggerService.warn(this, "Expected one ready UF_TopDrawer_BoolBox in the product");
            return;
        }

        const visibilityApplied = this._applyTransformConfig("sink", this.dataRule.visibility, (entity, value) =>
            SceneTransformHelper.setVisibleByState(entity, value),
        );
        if (!visibilityApplied) return;

        this._applied = await this._applyBooleanConfig("sink");
    }

    async _applyBooleanConfig(key) {
        const configuration = this.dataRule.boolean;
        const names = Object.keys(configuration.values);
        const targets = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(targets.map(entity => entity.name));
        if (names.some(name => !foundNames.has(name)) || targets.some(entity =>
            !entity.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh ||
            configuration.values[entity.name]?.[key] !== true)) {
            LoggerService.warn(this, "UF sink cabinet Boolean is not ready or configuration is invalid");
            return false;
        }
        const cutters = SceneEntityHelper.collectByNames(this.entity, ["UF_TopDrawer_BoolBox"]);
        if (cutters.length !== 1 || !SceneEntityHelper.getMeshInstances(cutters[0])[0]?.mesh) {
            LoggerService.warn(this, "Expected one ready UF_TopDrawer_BoolBox in the product");
            return false;
        }
        // Rebuild after all dimensions and drawer visibility have settled, including
        // 1D -> 2D transitions where the cutter's parent was previously disabled.
        // Those rules apply synchronously and the CSG reads world transforms lazily,
        // so the cut needs no frame delay.
        await Promise.all(targets.map(target => SceneBooleanHelper.configure(target, {
            enabled: configuration.values[target.name][key],
            cutters,
            operation: OperationType.SUBTRACT,
        }, { debounceMs: 0, delayFrames: 0 })));

        return targets.every(target => {
            const mb = target.script.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(target)[0]?.mesh;
            return mb.booleanEnabled === true && !!mb._sourceMesh && !!mesh &&
                mesh !== mb._sourceMesh && (!cutters[0].parent || cutters[0].parent.enabled);
        });
    }
}
