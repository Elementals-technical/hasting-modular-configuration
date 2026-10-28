import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { OperationType } from '../../../../../../mesh-boolean/core/MeshBooleanOperation.mjs';

/** Apply Mako sink cuts after layout; the cabinet floor cut is only for 26 cm. */ class RuleTypeSinkCabinetMako extends BaseProductRule {
    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._applied || super.shouldExecute(changes, currentState, previousState));
    }
    async execute({ currentState }) {
        const height = Number(currentState.get('Height'));
        if (height !== 26 && height !== 52) {
            LoggerService.warn(this, 'Unsupported Mako sink cabinet height', {
                height
            });
            return;
        }
        if (this._applied && this._appliedHeight === height) return;
        this._applied = false;
        const visibleNames = Object.keys(this.dataRule.visibility.values);
        const visible = SceneEntityHelper.collectByNames(this.entity, visibleNames);
        const foundNames = new Set(visible.map((entity)=>entity.name));
        if (visibleNames.some((name)=>!foundNames.has(name))) {
            LoggerService.warn(this, 'Mako sink cabinet visibility entities are missing');
            return;
        }
        // Validate every target and required cutter before changing visibility or meshes.
        const cuts = this._collectBooleanCuts(height);
        if (!cuts) return;
        const applyVisibility = ()=>this._applyTransformConfig(height, this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
        if (!applyVisibility()) return;
        const booleanApplied = await this._applyBooleanConfig(height, cuts);
        // The Boolean helper hides cutters; restore the explicit Mako table visibility.
        const visibilityApplied = applyVisibility();
        this._applied = booleanApplied && visibilityApplied;
        if (this._applied) this._appliedHeight = height;
    }
    _collectBooleanCuts(key) {
        const cuts = [];
        for (const [target, values] of Object.entries(this.dataRule.boolean.values)){
            const enabled = values[key];
            if (typeof enabled !== 'boolean') {
                LoggerService.warn(this, 'Mako sink Boolean configuration value missing', {
                    target,
                    key
                });
                return null;
            }
            const cutter = this.booleanCutters[target];
            const targets = SceneEntityHelper.collectByNames(this.entity, [
                target
            ]);
            const cutters = SceneEntityHelper.collectByNames(this.entity, [
                cutter
            ]);
            if (targets.length === 0 || targets.some((entity)=>!entity.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh)) {
                LoggerService.warn(this, 'Mako sink drawer Boolean is not ready', {
                    target
                });
                return null;
            }
            // Use cutters from this product instance, never template references.
            if (enabled && (cutters.length !== 1 || !SceneEntityHelper.getMeshInstances(cutters[0])[0]?.mesh)) {
                LoggerService.warn(this, 'Expected one ready Mako drawer cutter', {
                    cutter
                });
                return null;
            }
            for (const entity of targets)cuts.push({
                entity,
                cutter: cutters[0],
                enabled
            });
        }
        return cuts;
    }
    async _applyBooleanConfig(key, cuts = this._collectBooleanCuts(key)) {
        if (!cuts) return false;
        await Promise.all(cuts.map(({ entity, cutter, enabled })=>enabled ? SceneBooleanHelper.configure(entity, {
                enabled: true,
                cutters: [
                    cutter
                ],
                operation: OperationType.SUBTRACT
            }, {
                debounceMs: 0,
                delayFrames: 2
            }) : SceneBooleanHelper.setEnabled(entity, false, {
                immediate: true
            })));
        return cuts.every(({ entity, cutter, enabled })=>{
            const mb = entity.script?.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(entity)[0]?.mesh;
            if (!enabled) return mb?.booleanEnabled === false && !!mb._sourceMesh && mesh === mb._sourceMesh;
            return mb?.booleanEnabled === true && !!mb._sourceMesh && !!mesh && mesh !== mb._sourceMesh && (!cutter.parent || cutter.parent.enabled);
        });
    }
    constructor(){
        super({
            name: 'RuleTypeSinkCabinetMako',
            watchAttributes: [
                'Height'
            ],
            priority: 60
        });
        this.dataRule = {
            visibility: {
                values: {
                    Mako_Top_DrawerBoolBox: {
                        26: 'Enable',
                        52: 'Enable'
                    },
                    Mako_Bot_DrawerFramingDD: {
                        26: 'Enable',
                        52: 'Enable'
                    },
                    Mako_Top_DrawerPlumFraming: {
                        26: 'Enable',
                        52: 'Enable'
                    }
                }
            },
            boolean: {
                values: {
                    Mako_Top_DrawerWalls: {
                        26: true,
                        52: true
                    },
                    Mako_Bot_DrawerWalls: {
                        26: true,
                        52: true
                    },
                    CLMa_Cabinet_Floor: {
                        26: true,
                        52: false
                    }
                }
            }
        };
        this.booleanCutters = {
            Mako_Top_DrawerWalls: 'Mako_Top_DrawerBoolBox',
            Mako_Bot_DrawerWalls: 'Mako_Bot_DrawerBoolBox',
            CLMa_Cabinet_Floor: 'Mako_Cabinet_SBBoolBox'
        };
        this._applied = false;
        this._appliedHeight = null;
    }
}

export { RuleTypeSinkCabinetMako };
