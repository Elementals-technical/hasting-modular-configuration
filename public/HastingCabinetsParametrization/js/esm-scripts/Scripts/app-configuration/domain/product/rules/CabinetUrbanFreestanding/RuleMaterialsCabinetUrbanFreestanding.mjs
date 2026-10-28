import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/** UrbanFreestanding materials: cabinet finish and fixed interior materials. */ class RuleMaterialsCabinetUrbanFreestanding extends BaseProductRule {
    shouldExecute(changes, currentState, previousState) {
        return this.enabled && (!this._hasAppliedMaterials || super.shouldExecute(changes, currentState, previousState));
    }
    async execute({ currentState }) {
        const cabinet = this._materialName(currentState.get('CabinetColor'));
        this._hasAppliedMaterials = false;
        let applied = true;
        for (const [group, materialName] of [
            [
                'cabinet',
                cabinet
            ],
            ...Object.entries(this.fixedMaterials)
        ]){
            if (materialName) applied = await this._applyGroup(group, materialName) && applied;
        }
        this._hasAppliedMaterials = applied;
    }
    _materialName(value) {
        const name = String(value ?? '').trim();
        return !name || name === 'None' ? null : name;
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
                LoggerService.warn(this, 'UrbanFreestanding material entity not found', {
                    productId: this.productId,
                    entityName: name,
                    group
                });
                applied = false;
            }
        }
        const targets = entities.filter((entity)=>{
            if (this._meshInstances(entity).length) return true;
            LoggerService.warn(this, 'UrbanFreestanding material entity has no meshes', {
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
            name: 'RuleMaterialsCabinetUrbanFreestanding',
            watchAttributes: [
                'CabinetColor'
            ],
            priority: 50
        });
        this.materialTargets = {
            cabinet: [
                'UF_Cabinet_HBracket',
                'UF_Cabinet_Mount',
                'UF_Cabinet_SBBackWall',
                'UF_Cabinet_Walls',
                'UF_HandleNoCut_Top',
                'UF_HandleTopCut_Top',
                'UF_HandleNoCut_Bot',
                'UF_HandleTopCut_Bot',
                'UF_HandleBotCut_Top',
                'UF_Overlay_BotCut_Top',
                'UF_Overlay_NoCut_Top',
                'UF_Overlay_TopCut_Top',
                'UF_Overlay_NoCut_Bot',
                'UF_Overlay_TopCut_Bot',
                'UF_Filler_Leg',
                'UF_OS_Back',
                'UF_OS_Body',
                'UF_OS_DividerBot',
                'UF_OS_DividerTop',
                'UF_OSS_BackShelf_Bot',
                'UF_OSS_BackShelf_Top',
                'UF_OSS_Body',
                'UF_OSS_FrontShelf_Bot',
                'UF_OSS_FrontShelf_Top',
                'UF_OSS_MidWall'
            ],
            metal: [
                'UF_TopDrawer_Hinge',
                'UF_BotDrawer_Hinge'
            ],
            interior: [
                'UF_Drawer_Framing',
                'UF_TopDrawer_HighWalls',
                'UF_TopDrawer_LowWalls',
                'UF_BotDrawer_Walls'
            ],
            boolean: [
                'UF_TopDrawer_BoolBox'
            ]
        };
        this.fixedMaterials = {
            metal: 'SimpleMetalMat',
            interior: 'Antracite Matte OCF',
            boolean: 'BoolMat'
        };
        this._appliedMaterials = new WeakMap();
        this._hasAppliedMaterials = false;
    }
}

export { RuleMaterialsCabinetUrbanFreestanding };
