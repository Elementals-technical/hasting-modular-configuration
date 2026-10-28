import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/** Urban Duplex other materials from the material table. */
export class RuleMaterialsOtherUrbanDuplex extends BaseProductRule {
    constructor() {
        super({ name: 'RuleMaterialsOtherUrbanDuplex', watchAttributes: [], priority: 56 });
        this.materialTargets = {
            interior: [
                'UD_TopDrawer_BigFrame',
                'UD_BotDrawer_High_BigFrame',
                'UD_BotDrawer_High_SmallFrame',
                'UD_BotDrawer_Low_BigFrame',
                'UD_BotDrawer_Low_SmallFrame',
                'UD_Handle_Inner_Top',
                'UD_TopDrawer_Walls',
                'UD_BotDrawer_High_Walls',
                'UD_BotDrawer_Low_Walls'
            ],
            boolean: [
                'UD_Cabinet_BoolBox',
                'UD_TopDrawer_BoolBox',
                'UD_BotDrawer_BoolBox_BigFrame',
                'UD_BotDrawer_BoolBox_SmallFrame'
            ],
            metal: [
                'UD_Cabinet_Bolts',
                'UD_TopDrawer_Hinge',
                'UD_BotDrawer_Hinge'
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
        for (const [group, materialName] of [['interior', 'Antracite Matte OCF'], ['boolean', 'BoolMat'], ['metal', 'SimpleMetalMat']]) {
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

