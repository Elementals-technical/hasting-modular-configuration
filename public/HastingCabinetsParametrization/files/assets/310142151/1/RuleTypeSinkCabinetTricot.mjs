import { BaseProductRule } from "../../base-product-rule.mjs";
import { MeshRuleConfigBuilder } from "../../../../../helpers/mesh-rule-config-builder.mjs";
import { SceneEntityHelper } from "../../../../../helpers/scene-entity-helper.mjs";
import { SceneBooleanHelper } from "../../../../../helpers/scene-boolean-helper.mjs";
import { SceneTransformHelper } from "../../../../../helpers/scene-transform-helper.mjs";
import { LoggerService } from "../../../../../services/logger/logger-service.mjs";
import { OperationType } from "../../../../../../mesh-boolean/core/MeshBooleanOperation.mjs";

/** Tricot Sink cabinet setup after width and drawer layout. */
export class RuleTypeSinkCabinetTricot extends BaseProductRule {
    constructor() {
        super({ name: "RuleTypeSinkCabinetTricot", watchAttributes: ["Width", "Drawers"], priority: 60 });

        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create()
                .breakpoints(["2D", "1D", "1DWID"])
                .meshes(["Tricot_Top_Drawer_Framing"])
                .values({ "2D": "Enable", "1D": "Enable", "1DWID": "Enable" })
                .meshes(["Tricot_Bot_Drawer_Framing"])
                .values({ "2D": "Disable", "1D": "Enable", "1DWID": "Disable" })
                .build(),
            boolean: MeshRuleConfigBuilder.create()
                .breakpoints(["2D", "1D", "1DWID"])
                .meshes(["Tricot_Top_Drawer_Floor"])
                .values({ "2D": true, "1D": false, "1DWID": true })
                .meshes(["Tricot_Bot_Drawer_Floor", "Tricot_Cabinet_Floor"])
                .values({ "2D": false, "1D": true, "1DWID": false })
                .build(),
            stretchZ: MeshRuleConfigBuilder.create()
                .breakpoints(["2D", "1D", "1DWID"])
                .meshes(["Tricot_Cabinet_Floor"])
                .values({ "2D": { z: -0.725 }, "1D": { z: -0.725 }, "1DWID": { z: 0 } })
                .build(),
        };
        this._applied = false;
        this.booleanTargets = [
            { target: "Tricot_Top_Drawer_Floor", cutter: "Tricot_Top_Drawer_BoolB" },
            { target: "Tricot_Bot_Drawer_Floor", cutter: "Tricot_Bot_Drawer_BoolB" },
            { target: "Tricot_Cabinet_Floor", cutter: "Tricot_Cabinet_SBBoolBox" },
        ];
    }

    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._applied || super.shouldExecute(changes, currentState, previousState));
    }

    async execute({ currentState }) {
        const mode = currentState.get("Drawers");
        if (!this.dataRule.visibility.breakpoints.includes(mode)) {
            LoggerService.warn(this, "Unsupported Tricot drawer mode", { mode });
            return;
        }

        this._applied = false;
        const visibilityApplied = this._applyTransformConfig(mode, this.dataRule.visibility, (entity, value) =>
            SceneTransformHelper.setVisibleByState(entity, value),
        );
        const stretchApplied = this._applyTransformConfig(mode, this.dataRule.stretchZ, (entity, value) =>
            SceneTransformHelper.setStretch(entity, value),
        );
        if (!visibilityApplied || !stretchApplied) return;

        this._applied = await this._applyBooleanConfig(mode);
    }

    /** Configure product-local cutters and rebuild or restore each floor. */
    async _applyBooleanConfig(mode) {
        const cuts = [];
        for (const { target, cutter } of this.booleanTargets) {
            const enabled = this.dataRule.boolean.values[target][mode];
            const targets = SceneEntityHelper.collectByNames(this.entity, [target]);
            const cutters = enabled ? SceneEntityHelper.collectByNames(this.entity, [cutter]) : [];
            if (
                !targets.length ||
                targets.some(
                    (entity) => !entity.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh,
                )
            ) {
                LoggerService.warn(this, "Tricot floor scripts or meshes are not ready", { target });
                return false;
            }
            if (enabled && (cutters.length !== 1 || !SceneEntityHelper.getMeshInstances(cutters[0])[0]?.mesh)) {
                LoggerService.warn(this, "Expected one ready Tricot cutter in the product", { cutter });
                return false;
            }
            for (const entity of targets) cuts.push({ entity, cutter: cutters[0], enabled });
        }
        await Promise.all(
            cuts.map(({ entity, cutter, enabled }) =>
                enabled
                    ? SceneBooleanHelper.configure(
                          entity,
                          { enabled: true, cutters: [cutter], operation: OperationType.SUBTRACT },
                          { debounceMs: 0, delayFrames: 2 },
                      )
                    : SceneBooleanHelper.setEnabled(entity, false, { immediate: true }),
            ),
        );
        return cuts.every(({ entity, enabled, cutter }) => {
            const mb = entity.script.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(entity)[0]?.mesh;
            if (!enabled) return mb.booleanEnabled === false && !!mb._sourceMesh && mesh === mb._sourceMesh;
            return (
                mb.booleanEnabled === true &&
                !!mb._sourceMesh &&
                !!mesh &&
                mesh !== mb._sourceMesh &&
                (!cutter.parent || cutter.parent.enabled)
            );
        });
    }
}
