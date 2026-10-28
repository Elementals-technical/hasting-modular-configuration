import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/** Urban Duplex cabinet materials from the material table. */
export class RuleMaterialsCabinetUrbanDuplex extends BaseProductRule {
    constructor() {
        super({ name: 'RuleMaterialsCabinetUrbanDuplex', watchAttributes: ['CabinetColor'], priority: 50 });
        this.materialTargets = {
            cabinet: [
                'UD_Cabinet_Mount',
                'UD_Cabinet_SCBackWall',
                'UD_Cabinet_Walls',
                'UD_Handle_BaseP_Top',
                'UD_Handle_Full_Top',
                'UD_Handle_BaseP_Bot',
                'UD_Handle_Full_Bot',
                'OpenShelvesBack',
                'OpenShelvesDivider',
                'OpenShelvesSideWalls',
                'OpenShelvesTopBot',
                'OpenSideShelvesBackWall',
                'OpenSideShelvesFrontShelf',
                'OpenSideShelvesMidWall',
                'OpenSideShelvesBackShelf',
                'OpenSideShelvesSideWall',
                'SidePanel_UpperG_46D_Panel',
                'SidePanel_UpperG_50D_Panel',
                'SidePanel_DoubleG_50D_Panel',
                'SidePanel_DoubleG_46D_Panel',
                'SidePanel_NoG_50H_46D_Panel',
                'SidePanel_NoG_53H_46D_Panel',
                'SidePanel_NoG_56H_46D_Panel',
                'SidePanel_NoG_50H_50D_Panel',
                'SidePanel_NoG_53H_50D_Panel',
                'SidePanel_NoG_56H_50D_Panel',
                'ULH_UniSidePanel_Panel'
            ]
        };
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
    }

    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._hasAppliedMaterials || super.shouldExecute(changes, currentState, previousState));
    }

    async execute({ currentState }) {
        this._hasAppliedMaterials = false;
        let applied = true;
        for (const [group, materialName] of [['cabinet', this._materialName(currentState.get('CabinetColor'))]]) {
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
                LoggerService.warn(this, 'Urban Duplex material entity not found', { productId: this.productId, entityName: name, group });
                applied = false;
            }
        }
        const targets = entities.filter(entity => {
            if (this._meshInstances(entity).length) return true;
            LoggerService.warn(this, 'Urban Duplex material entity has no meshes', { entityName: entity.name, group });
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

