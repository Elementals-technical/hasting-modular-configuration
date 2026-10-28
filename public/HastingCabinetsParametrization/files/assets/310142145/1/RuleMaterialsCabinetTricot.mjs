import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/** Tricot materials: cabinet finish and fixed interior materials. */
export class RuleMaterialsCabinetTricot extends BaseProductRule {
    constructor() {
        super({ name: 'RuleMaterialsCabinetTricot', watchAttributes: ['CabinetColor'], priority: 50 });
        this.materialTargets = {
            cabinet: [
                'Tricot_Cabinet_Floor', 'CLMa_Cabinet_Walls',
                'Tricot_Top_Drawer_Handle', 'Tricot_Top_Drawer_Handle_Flut',
                'Tricot_Bot_Drawer_Handle', 'Tricot_Bot_Drawer_Handle_Flut', 'Tricot_SidePanel_Panel',
            ],
            interior: [
                'Tricot_Top_Drawer_Floor', 'Tricot_Top_Drawer_Framing', 'Tricot_Top_Drawer_HandleInner',
                'Tricot_Top_Drawer_Hinge', 'Tricot_Bot_Drawer_Floor', 'Tricot_Bot_Drawer_Framing',
                'Tricot_Bot_Drawer_Hinge',
            ],
            boolean: ['Tricot_Cabinet_SBBoolBox', 'Tricot_Bot_Drawer_BoolB', 'Tricot_Top_Drawer_BoolB'],
        };
        this.fixedMaterials = { interior: 'Antracite Matte OCF', boolean: 'BoolMat' };
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
    }

    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._hasAppliedMaterials || super.shouldExecute(changes, currentState, previousState));
    }

    async execute({ currentState }) {
        const cabinet = this._materialName(currentState.get('CabinetColor'));

        this._hasAppliedMaterials = false;
        let applied = true;
        for (const [group, materialName] of [['cabinet', cabinet], ...Object.entries(this.fixedMaterials)]) {
            if (materialName) applied = await this._applyGroup(group, materialName) && applied;
        }
        this._hasAppliedMaterials = applied;
    }

    _materialName(value) {
        const name = String(value ?? '').trim();
        return !name || name === 'None' ? null : name;
    }

    _meshInstances(entity) {
        return [...(entity.render?.meshInstances || []), ...(entity.model?.meshInstances || [])];
    }

    async _applyGroup(group, materialName) {
        const names = this.materialTargets[group];
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const found = new Set(entities.map(entity => entity.name));
        let applied = true;
        for (const name of names) {
            if (!found.has(name)) {
                LoggerService.warn(this, 'Tricot material entity not found', { productId: this.productId, entityName: name, group });
                applied = false;
            }
        }
        const targets = entities.filter(entity => {
            if (this._meshInstances(entity).length) return true;
            LoggerService.warn(this, 'Tricot material entity has no meshes', { entityName: entity.name, group });
            applied = false;
            return false;
        });
        if (!targets.length) return false;
        const material = await MaterialService.loadMaterial(materialName);
        const pending = targets.filter(entity => {
            const meshes = this._meshInstances(entity);
            if (meshes.every(mi => mi.material === material)) return false;
            const previous = this._appliedMaterials.get(entity);
            return !previous || previous.materialName !== materialName || previous.source !== material ||
                previous.meshes.length !== meshes.length || meshes.some((mi, index) =>
                    previous.meshes[index].instance !== mi || previous.meshes[index].material !== mi.material);
        });
        if (pending.length) {
            await MaterialService.applyMaterialByName(materialName, pending);
            for (const entity of pending) {
                this._appliedMaterials.set(entity, {
                    materialName, source: material,
                    meshes: this._meshInstances(entity).map(mi => ({ instance: mi, material: mi.material })),
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
}

