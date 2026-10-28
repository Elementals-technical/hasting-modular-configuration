import { BaseProductRule } from '../../base-product-rule.mjs';
import { MeshRuleConfigBuilder } from '../../../../../helpers/mesh-rule-config-builder.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';

/** Tricot Side cabinet setup after width and drawer layout. */ class RuleTypeSideCabinetTricot extends BaseProductRule {
    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._applied || super.shouldExecute(changes, currentState, previousState));
    }
    async execute({ currentState }) {
        const mode = currentState.get("Drawers");
        if (!this.dataRule.visibility.breakpoints.includes(mode)) {
            LoggerService.warn(this, "Unsupported Tricot drawer mode", {
                mode
            });
            return;
        }
        this._applied = false;
        const visibilityApplied = this._applyTransformConfig(mode, this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        const stretchApplied = this._applyTransformConfig(mode, this.dataRule.stretchZ, (entity, value)=>SceneTransformHelper.setStretch(entity, value));
        if (!visibilityApplied || !stretchApplied) return;
        this._applied = await this._applyBooleanConfig(mode);
    }
    /** Side cabinets restore solid floors; no cutters are needed. */ async _applyBooleanConfig(mode) {
        const configuration = this.dataRule.boolean;
        const names = Object.keys(configuration.values);
        const targets = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(targets.map((entity)=>entity.name));
        if (names.some((name)=>!foundNames.has(name)) || targets.some((entity)=>!entity.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh)) {
            LoggerService.warn(this, "Tricot side cabinet Boolean floors are not ready", {
                productId: this.productId
            });
            return false;
        }
        await Promise.all(targets.map((entity)=>SceneBooleanHelper.setEnabled(entity, configuration.values[entity.name][mode], {
                immediate: true
            })));
        return targets.every((entity)=>{
            const mb = entity.script.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(entity)[0]?.mesh;
            return mb.booleanEnabled === false && !!mb._sourceMesh && mesh === mb._sourceMesh;
        });
    }
    constructor(){
        super({
            name: "RuleTypeSideCabinetTricot",
            watchAttributes: [
                "Width",
                "Drawers"
            ],
            priority: 60
        });
        this.dataRule = {
            visibility: MeshRuleConfigBuilder.create().breakpoints([
                "2D",
                "1D",
                "1DWID"
            ]).meshes([
                "Tricot_Top_Drawer_Framing",
                "Tricot_Bot_Drawer_Framing"
            ]).values({
                "2D": "Disable",
                "1D": "Disable",
                "1DWID": "Disable"
            }).build(),
            boolean: MeshRuleConfigBuilder.create().breakpoints([
                "2D",
                "1D",
                "1DWID"
            ]).meshes([
                "Tricot_Top_Drawer_Floor",
                "Tricot_Bot_Drawer_Floor",
                "Tricot_Cabinet_Floor"
            ]).values({
                "2D": false,
                "1D": false,
                "1DWID": false
            }).build(),
            stretchZ: MeshRuleConfigBuilder.create().breakpoints([
                "2D",
                "1D",
                "1DWID"
            ]).meshes([
                "Tricot_Cabinet_Floor"
            ]).values({
                "2D": {
                    z: -0.725
                },
                "1D": {
                    z: -0.725
                },
                "1DWID": {
                    z: -0.725
                }
            }).build()
        };
        this._applied = false;
    }
}

export { RuleTypeSideCabinetTricot };
