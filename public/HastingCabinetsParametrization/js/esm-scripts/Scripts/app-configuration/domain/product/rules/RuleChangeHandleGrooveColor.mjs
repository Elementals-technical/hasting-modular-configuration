import * as playcanvasStable_min from '../../../../../../playcanvas-stable.min.mjs';
import { app } from '../../../../../../playcanvas-stable.min.mjs';
import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../services/material/material-service.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */ class RuleChangeHandleGrooveColor extends BaseProductRule {
    collectMaterials() {
        this._materialAssets = [];
        const seenIds = new Set();
        this._materialTags.forEach((tag)=>{
            // findByTag gets metadata even if asset is not loaded (Preload: false)
            const assets = this.app.assets.findByTag(tag);
            assets.forEach((a)=>{
                if (a.type === 'material' && !seenIds.has(a.id)) {
                    this._materialAssets.push(a);
                    seenIds.add(a.id);
                }
            });
        });
        this._materialAssets.sort((a, b)=>a.name.localeCompare(b.name));
    }
    onInitialize() {
        LoggerService.log(this, `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ async execute({ currentState, previousState }) {
        let rawValue = currentState.get('HandleGrooveColor');
        const cabinetColor = currentState.get('CabinetColor');
        if (!cabinetColor && (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === 'None')) {
            LoggerService.log(this, '⚠️ [RuleChangeHandleGrooveColor] No CabinetColor available for groove reset');
            return;
        }
        // debugger
        // На випадок, якщо атрибут не заповнений
        if (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === 'None') {
            LoggerService.log(this, '🎨 [RuleChangeHandleGrooveColor] HandleGrooveColor is None, reverting active grooves to CabinetColor', {
                cabinetColor
            });
            await this._applyGrooveState(currentState, cabinetColor, cabinetColor);
            return;
        }
        // Якщо десь був parseInt – нормалізуємо, але зберігаємо як стрінгу
        // cabinetColor = назва матеріалу
        const grooveColor = rawValue;
        LoggerService.log(this, '🎨 [RuleApplyCabinetMaterial] Executing', {
            rawValue,
            normalized: grooveColor,
            prev: previousState?.get('HandleGrooveColor')
        });
        // // Якщо матеріал не змінився – можна скіпнути
        // if (this._lastMaterialName === cabinetColor) {
        //     LoggerService.log(
        //         this,
        //         'ℹ️ [RuleApplyCabinetMaterial] Material not changed, skip reapply',
        //         { cabinetColor }
        //     );
        //     return;
        // }
        await this._applyGrooveState(currentState, grooveColor, cabinetColor);
    }
    async _applyGrooveState(currentState, activeMaterialName, cabinetMaterialName) {
        const activeSlotKeys = this._resolveActiveSlotKeys(currentState);
        const activeEntities = [];
        const inactiveEntities = [];
        let disabledCount = 0;
        let enabledCount = 0;
        Object.entries(this.grooveSlots).forEach(([slotKey, slot])=>{
            const entities = this._collectSlotEntities(slot);
            if (entities.length === 0) return;
            const isActive = activeSlotKeys.has(slotKey);
            if (isActive) {
                if (slot.canDisable) {
                    enabledCount += this._setEntitiesEnabled(entities, true);
                }
                activeEntities.push(...entities);
                return;
            }
            inactiveEntities.push(...entities);
            if (slot.canDisable) {
                disabledCount += this._setEntitiesEnabled(entities, false);
            }
        });
        if (cabinetMaterialName && inactiveEntities.length > 0) {
            await this._applyCabinetMaterialToEntities(cabinetMaterialName, inactiveEntities);
        }
        if (activeMaterialName && activeEntities.length > 0) {
            if (activeMaterialName === cabinetMaterialName) {
                await this._applyCabinetMaterialToEntities(cabinetMaterialName, activeEntities);
            } else {
                await this._applyMaterialByName(activeMaterialName, activeEntities);
            }
        }
        LoggerService.log(this, '✅ [RuleChangeHandleGrooveColor] Groove state normalized', {
            activeSlots: [
                ...activeSlotKeys
            ],
            activeEntities: activeEntities.map((e)=>e.name),
            inactiveEntities: inactiveEntities.map((e)=>e.name),
            enabledCount,
            disabledCount
        });
    }
    _resolveActiveSlotKeys(currentState) {
        const drawers = currentState.get('Drawers');
        const handle = currentState.get('Handle');
        const sidePanelType = currentState.get('SidePanelType');
        const active = new Set();
        if (drawers === '2D') {
            if (handle === 'handle_urban_topcut') {
                active.add('cabinetUpper');
                active.add('cabinetLower');
            } else if (handle === 'handle_urban_botcut') {
                active.add('cabinetLower');
            }
        } else if (drawers === '1D' || drawers === '1DWID') {
            if (handle === 'handle_urban_topcut' || handle === 'handle_urban_botcut') {
                active.add('cabinetUpper');
            }
        }
        if (sidePanelType === 'UpperG') active.add('sideUpper');
        if (sidePanelType === 'CenterG') active.add('sideCenter');
        if (sidePanelType === 'DoubleG') active.add('sideDouble');
        return active;
    }
    _collectSlotEntities(slot) {
        return SceneEntityHelper.collectByNames(this.context.entity, slot.names);
    }
    _setEntitiesEnabled(entities, enabled) {
        let changedCount = 0;
        entities.forEach((entity)=>{
            if (entity.enabled !== enabled) {
                entity.enabled = enabled;
                changedCount++;
            }
        });
        return changedCount;
    }
    _getAllGrooveTargetNames() {
        return Object.values(this.grooveSlots).flatMap((slot)=>slot.names);
    }
    // ================== Пошук і завантаження матеріалу ==================
    _getApp() {
        // Контекст, як правило, містить entity; з неї беремо app
        if (this.context?.entity?.app) return this.context.entity.app;
        if (typeof playcanvasStable_min !== 'undefined' && app) return app; // fallback
        return null;
    }
    async _applyCabinetMaterialToEntities(materialName, entities) {
        if (!materialName || !entities || entities.length === 0) return;
        if (this._restoreMaterialFromScene(materialName, entities)) return;
        await this._applyMaterialByName(materialName, entities);
    }
    async _applyMaterialByName(materialName, targetEntities = null) {
        const rootEntity = this.context.entity;
        const entities = targetEntities || SceneEntityHelper.collectByNames(rootEntity, this.listNameMaterial).flat();
        if (entities.length === 0) {
            LoggerService.log(this, '⚠️ [RuleChangeHandleGrooveColor] No target entities found', {
                materialName,
                targets: this.listNameMaterial
            });
            return;
        }
        const material = await MaterialService.loadMaterial(materialName);
        const entitiesToApply = entities.filter((entity)=>!this._areEntitiesAlreadyUsingMaterial([
                entity
            ], material));
        // Regression guard:
        // HandleGrooveColor=None can resolve to the same CabinetColor that is
        // already on these entities. Reapplying it would refresh TriPlanar and
        // can rewrite shader params such as tri_scale, tri_normalTex, tri_glossTex.
        if (entitiesToApply.length === 0) {
            LoggerService.log(this, 'ℹ️ [RuleChangeHandleGrooveColor] Target material already applied, skip reapply', {
                materialName
            });
            return;
        }
        await MaterialService.applyMaterialByName(materialName, entitiesToApply);
    }
    _areEntitiesAlreadyUsingMaterial(entities, material) {
        const meshInstances = entities.flatMap((entity)=>SceneEntityHelper.getMeshInstances(entity));
        if (meshInstances.length === 0) {
            return false;
        }
        return meshInstances.every((mi)=>mi.material === material);
    }
    _restoreMaterialFromScene(materialName, targetEntities = null) {
        const rootEntity = this.context.entity;
        const entities = targetEntities || SceneEntityHelper.collectByNames(rootEntity, this.listNameMaterial).flat();
        if (entities.length === 0) return false;
        const targets = new Set(entities);
        const normalizedName = this._normalizeMaterialName(materialName);
        let sceneMaterial = null;
        SceneEntityHelper.collectByPredicate(rootEntity, (entity)=>!targets.has(entity) && entity.script?.triPlanarMapping).some((entity)=>{
            const meshInstances = SceneEntityHelper.getMeshInstances(entity);
            sceneMaterial = meshInstances.find((mi)=>this._normalizeMaterialName(mi.material?.name) === normalizedName)?.material || null;
            return !!sceneMaterial;
        });
        if (!sceneMaterial) return false;
        entities.forEach((entity)=>{
            SceneEntityHelper.getMeshInstances(entity).forEach((mi)=>{
                mi.material = sceneMaterial;
            });
        });
        return true;
    }
    _normalizeMaterialName(name) {
        return String(name || '').trim().replace(/(?:_triplanar_unique)+$/i, '').replace(/\s+/g, ' ').toLowerCase();
    }
    constructor(context){
        super({
            name: 'ChangeHandleGrooveColor',
            watchAttributes: [
                'HandleGrooveColor',
                'CabinetColor',
                'Drawers',
                'Handle',
                'Depth',
                'Height',
                'SidePanelType'
            ],
            priority: 30
        }), // State
        _define_property(this, "_materialAssets", []);
        this.context = context;
        this.grooveSlots = {
            cabinetUpper: {
                names: [
                    "CabinetFrontTopPlate"
                ],
                canDisable: false
            },
            cabinetLower: {
                names: [
                    "CabinetFBotPlate"
                ],
                canDisable: false
            },
            sideUpper: {
                names: [
                    "SidePanel_UpperG_46D_Inlay",
                    "SidePanel_UpperG_50D_Inlay"
                ],
                canDisable: true
            },
            sideCenter: {
                names: [
                    "SidePanel_CenterG_46D_Inlay",
                    "SidePanel_CenterG_50D_Inlay"
                ],
                canDisable: true
            },
            sideDouble: {
                names: [
                    "SidePanel_DoubleG_46D_Inlay",
                    "SidePanel_DoubleG_50D_Inlay"
                ],
                canDisable: true
            }
        };
        this.listNameMaterial = this._getAllGrooveTargetNames();
    }
}

export { RuleChangeHandleGrooveColor };
