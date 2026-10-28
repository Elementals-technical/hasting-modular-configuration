import { BaseProductRule } from '../../base-product-rule.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';
import { OperationType } from '../../../../../../mesh-boolean/core/MeshBooleanOperation.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';

/** Urban Duplex side: apply SC wall visibility and restore solid meshes. */ class RuleTypeSideCabinetUrbanDuplex extends BaseProductRule {
    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._applied || super.shouldExecute(changes, currentState, previousState));
    }
    async execute({ currentState }) {
        const height = Number(currentState.get('Height'));
        const drawers = currentState.get('Drawers') ?? '2D';
        if (![
            56,
            53,
            38,
            28
        ].includes(height) || ![
            '2D',
            '1DWID',
            '1D'
        ].includes(drawers) || height === 53 && drawers === '2D') {
            console.warn(`[${this.name}] No SB/SC table configuration for Height/Drawers`, {
                height,
                drawers
            });
            return;
        }
        this._applied = false;
        const key = height + ':' + drawers;
        const visibility = this.dataRule.visibility;
        const cuts = Object.fromEntries(Object.entries(this.dataRule.boolean.values).map(([name, values])=>[
                name,
                values[key]
            ]));
        const names = [
            ...new Set([
                ...Object.keys(visibility.values),
                ...Object.keys(this.dataRule.boolean.values),
                ...Object.values(cuts).filter(Boolean)
            ])
        ];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const byName = new Map();
        let complete = true;
        for (const name of names){
            const matches = entities.filter((entity)=>entity.name === name);
            if (matches.length !== 1) {
                console.warn(`[${this.name}] Expected one product entity`, {
                    entityName: name,
                    count: matches.length
                });
                complete = false;
                continue;
            }
            byName.set(name, matches[0]);
        }
        // Missing frames or other cutters must not block Boolean=False restoration.
        const visibilityApplied = this._applyTransformConfig(key, visibility, (entity, value)=>{
            // Keep the one-entity-per-name contract: ambiguous entities must not be changed.
            if (byName.get(entity.name) !== entity) return null;
            return SceneTransformHelper.setVisibleByState(entity, value);
        });
        // Restore solid targets even if unrelated frames or cutters are missing.
        const booleanApplied = await this._applyBooleanConfig(key, byName);
        this._applied = complete && visibilityApplied && booleanApplied;
    }
    async _enableCut(entity, cutter) {
        if (!entity?.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh || !cutter || !SceneEntityHelper.getMeshInstances(cutter)[0]?.mesh) {
            console.warn(`[${this.name}] Cut target or cutter is not ready`, {
                target: entity?.name,
                cutter: cutter?.name
            });
            return false;
        }
        await SceneBooleanHelper.configure(entity, {
            enabled: true,
            cutters: [
                cutter
            ],
            operation: OperationType.SUBTRACT
        }, {
            debounceMs: 0,
            delayFrames: 2
        });
        const mb = entity.script.meshBoolean;
        const mesh = SceneEntityHelper.getMeshInstances(entity)[0]?.mesh;
        return mb.booleanEnabled === true && !!mb._sourceMesh && !!mesh && mesh !== mb._sourceMesh && mb.cutters?.length === 1 && mb.cutters[0] === cutter && (!cutter.parent || cutter.parent.enabled);
    }
    async _disableCut(entity) {
        if (!entity?.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(entity)[0]?.mesh) {
            console.warn(`[${this.name}] Cut target is not ready for restoration`, {
                target: entity?.name
            });
            return false;
        }
        await SceneBooleanHelper.setEnabled(entity, false, {
            immediate: true
        });
        const mb = entity.script.meshBoolean;
        return mb.booleanEnabled === false && !!mb._sourceMesh && SceneEntityHelper.getMeshInstances(entity)[0]?.mesh === mb._sourceMesh;
    }
    // Null entries restore solid meshes; cutter names enable product-local cuts.
    async _applyBooleanConfig(key, byName) {
        const results = await Promise.all(Object.entries(this.dataRule.boolean.values).map(([name, values])=>{
            const cutterName = values[key];
            return cutterName ? this._enableCut(byName.get(name), byName.get(cutterName)) : this._disableCut(byName.get(name));
        }));
        return results.every(Boolean);
    }
    constructor(){
        super({
            name: 'RuleTypeSideCabinetUrbanDuplex',
            watchAttributes: [
                'Width',
                'Height',
                'Depth',
                'Drawers'
            ],
            priority: 60
        });
        this.dataRule = {
            visibility: {
                values: {}
            },
            boolean: {
                values: {}
            }
        };
        for (const height of [
            56,
            53,
            38,
            28
        ]){
            for (const drawers of [
                '2D',
                '1DWID',
                '1D'
            ]){
                if (height === 53 && drawers === '2D') continue;
                const key = height + ':' + drawers;
                const high = height === 53 || height === 38;
                const visibility = {
                    UD_Cabinet_SCBackWall: true,
                    UD_TopDrawer_BigFrame: false,
                    UD_BotDrawer_High_Walls: high,
                    UD_BotDrawer_High_SmallFrame: false,
                    UD_BotDrawer_High_BigFrame: false,
                    UD_BotDrawer_Low_Walls: !high,
                    UD_BotDrawer_Low_SmallFrame: false,
                    UD_BotDrawer_Low_BigFrame: false
                };
                const cuts = {
                    UD_TopDrawer_Walls: null,
                    UD_BotDrawer_High_Walls: null,
                    UD_BotDrawer_Low_Walls: null,
                    UD_Cabinet_Walls: null
                };
                for (const [name, visible] of Object.entries(visibility)){
                    var _this_dataRule_visibility_values, _name;
                    ((_this_dataRule_visibility_values = this.dataRule.visibility.values)[_name = name] ?? (_this_dataRule_visibility_values[_name] = {}))[key] = visible ? 'Enable' : 'Disable';
                }
                for (const [name, cutter] of Object.entries(cuts)){
                    var _this_dataRule_boolean_values, _name1;
                    ((_this_dataRule_boolean_values = this.dataRule.boolean.values)[_name1 = name] ?? (_this_dataRule_boolean_values[_name1] = {}))[key] = cutter;
                }
            }
        }
        this._applied = false;
    }
}

export { RuleTypeSideCabinetUrbanDuplex };
