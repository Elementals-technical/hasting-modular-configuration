import { BaseProductRule } from "../../base-product-rule.mjs";
import { SceneEntityHelper } from "../../../../../helpers/scene-entity-helper.mjs";
import { SceneBooleanHelper } from "../../../../../helpers/scene-boolean-helper.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";

/** Restore solid Lame drawer walls and apply side framing and floor stretch before dimensions. */
export class RuleTypeSideCabinetLame extends BaseProductRule {
    constructor() {
        super({ name: "RuleTypeSideCabinetLame", watchAttributes: [], priority: 5 });
        this._applied = false;

        this.dataRule = {
            visibility: { values: { Lame_Top_Drawer_Framing: { side: "Disable" } } },
            boolean: { values: { Lame_Top_Drawer_Walls: { side: false } } },
            stretchZ: { values: { Lame_Cabinet_Floor: { side: { z: -0.702 } } } },
        };
    }

    shouldExecute() {
        return this.enabled && !this._applied;
    }

    async execute() {
        if (this._applied) return;
        const names = [...new Set(Object.values(this.dataRule).flatMap(config => Object.keys(config.values)))];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(entities.map((entity) => entity.name));
        const missing = names.filter((name) => !foundNames.has(name));
        if (missing.length) {
            LoggerService.warn(this, "Lame side cabinet entities are missing", { entityNames: missing });
            return;
        }
        const targets = entities.filter((entity) => entity.name in this.dataRule.boolean.values);
        if (
            targets.some(
                (target) => !target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh,
            )
        ) {
            LoggerService.warn(this, "Lame drawer Boolean is not ready");
            return;
        }

        const visibilityApplied = this._applyTransformConfig("side", this.dataRule.visibility, (entity, value) =>
            SceneTransformHelper.setVisibleByState(entity, value),
        );
        const stretchApplied = this._applyTransformConfig("side", this.dataRule.stretchZ, (entity, value) =>
            SceneTransformHelper.setStretch(entity, value),
        );
        if (!visibilityApplied || !stretchApplied) return;

        this._applied = await this._applyBooleanConfig("side");
    }

    /** Restore solid drawer walls once their Boolean scripts and meshes are ready. */
    async _applyBooleanConfig(key) {
        const configuration = this.dataRule.boolean;
        const names = Object.keys(configuration.values);
        const targets = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(targets.map(entity => entity.name));
        if (names.some(name => !foundNames.has(name)) || targets.some(entity =>
            !entity.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh ||
            configuration.values[entity.name]?.[key] !== false)) {
            LoggerService.warn(this, "Lame side cabinet Boolean walls are not ready or configuration is invalid");
            return false;
        }

        await Promise.all(targets.map(target => SceneBooleanHelper.setEnabled(
            target, configuration.values[target.name][key], { immediate: true },
        )));

        return targets.every((target) => {
            const mb = target.script.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(target)[0]?.mesh;
            return mb.booleanEnabled === false && !!mb._sourceMesh && mesh === mb._sourceMesh;
        });
    }
}
