import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/** Lame LegCapColor finish with HandleColor fallback. */ class RuleMaterialsLegCapLame extends BaseProductRule {
    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._hasAppliedMaterials || super.shouldExecute(changes, currentState, previousState));
    }
    async execute({ currentState }) {
        const finish = this._materialName(currentState.get("LegCapColor")) ?? this._materialName(currentState.get("HandleColor"));
        this._hasAppliedMaterials = false;
        if (finish) this._hasAppliedMaterials = await this._applyGroup("finish", finish);
    }
    _materialName(value) {
        const name = String(value ?? "").trim();
        return !name || name === "None" ? null : name;
    }
    _meshInstances(entity) {
        return [
            ...entity.render?.meshInstances || [],
            ...entity.model?.meshInstances || []
        ];
    }
    async _applyGroup(group, materialName) {
        const names = this.materialTargets[group];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const found = new Set(entities.map((entity)=>entity.name));
        let applied = true;
        for (const name of names){
            if (!found.has(name)) {
                LoggerService.warn(this, "Lame material entity not found", {
                    productId: this.productId,
                    entityName: name,
                    group
                });
                applied = false;
            }
        }
        const targets = entities.filter((entity)=>{
            if (this._meshInstances(entity).length) return true;
            LoggerService.warn(this, "Lame material entity has no meshes", {
                entityName: entity.name,
                group
            });
            applied = false;
            return false;
        });
        if (!targets.length) return false;
        const material = await MaterialService.loadMaterial(materialName);
        const pending = targets.filter((entity)=>{
            const meshes = this._meshInstances(entity);
            if (meshes.every((mi)=>mi.material === material)) return false;
            const previous = this._appliedMaterials.get(entity);
            return !previous || previous.materialName !== materialName || previous.source !== material || previous.meshes.length !== meshes.length || meshes.some((mi, index)=>previous.meshes[index].instance !== mi || previous.meshes[index].material !== mi.material);
        });
        if (pending.length) {
            await MaterialService.applyMaterialByName(materialName, pending);
            for (const entity of pending){
                this._appliedMaterials.set(entity, {
                    materialName,
                    source: material,
                    meshes: this._meshInstances(entity).map((mi)=>({
                            instance: mi,
                            material: mi.material
                        }))
                });
            }
        }
        return applied;
    }
    destroy() {
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
        super.destroy();
    }
    constructor(){
        super({
            name: "RuleMaterialsLegCapLame",
            watchAttributes: [
                "LegCapColor",
                "HandleColor"
            ],
            priority: 56
        });
        this.materialTargets = {
            finish: [
                "Lame_Leg_Long_Cap",
                "Lame_Leg_Short_Cap"
            ]
        };
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
    }
}

export { RuleMaterialsLegCapLame };
