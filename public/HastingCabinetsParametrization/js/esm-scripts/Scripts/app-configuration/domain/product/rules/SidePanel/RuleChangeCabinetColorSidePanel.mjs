import * as playcanvasStable_min from '../../../../../../../playcanvas-stable.min.mjs';
import { app } from '../../../../../../../playcanvas-stable.min.mjs';
import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

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
 */ class RuleChangeCabinetColorSidePanel extends BaseProductRule {
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
        let rawValue = currentState.get('CabinetColor');
        // На випадок, якщо атрибут не заповнений
        if (rawValue === undefined || rawValue === null || rawValue === '') {
            LoggerService.log(this, '⚠️ [RuleApplyCabinetMaterial] CabinetColor is empty, skip');
            return;
        }
        // Якщо десь був parseInt – нормалізуємо, але зберігаємо як стрінгу
        // cabinetColor = назва матеріалу
        const cabinetColor = String(rawValue).trim();
        LoggerService.log(this, '🎨 [RuleApplyCabinetMaterial] Executing', {
            rawValue,
            normalized: cabinetColor,
            prev: previousState?.get('CabinetColor')
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
        // If HandleGrooveColor is active, skip Inlay entities — they are handled by RuleChangeHandleGrooveColor
        const handleGrooveColor = currentState.get('HandleGrooveColor');
        const hasActiveGrooveColor = handleGrooveColor && handleGrooveColor !== 'None';
        const targetNames = hasActiveGrooveColor ? this.listNameMaterial.filter((name)=>!name.includes('_Inlay')) : this.listNameMaterial;
        await this._applyMaterialByName(cabinetColor, targetNames);
    }
    // ================== Пошук і завантаження матеріалу ==================
    _getApp() {
        // Контекст, як правило, містить entity; з неї беремо app
        if (this.context?.entity?.app) return this.context.entity.app;
        if (typeof playcanvasStable_min !== 'undefined' && app) return app; // fallback
        return null;
    }
    async _applyMaterialByName(materialName, namesList = this.listNameMaterial) {
        const rootEntity = this.context.entity;
        const entities = SceneEntityHelper.collectByNames(rootEntity, namesList);
        await MaterialService.applyMaterialByName(materialName, entities.flat());
    }
    constructor(context){
        super({
            name: 'ChangeCabinetColorSidePanel',
            watchAttributes: [
                'CabinetColor',
                'HandleGrooveColor'
            ],
            priority: 20
        }), // State
        _define_property(this, "_materialAssets", []), _define_property(this, "_appliedMaterialName", null), _define_property(this, "_requestedMaterialName", null), _define_property(this, "_materialRequestId", 0), _define_property(this, "_isApplying", false);
        this.context = context;
        // Твої дані з таблиці
        this.listNameMaterial = [
            // Side Panels
            "SidePanel_CenterG_46D_Inlay",
            "SidePanel_CenterG_46D_Panel",
            "SidePanel_CenterG_50D_Inlay",
            "SidePanel_CenterG_50D_Panel",
            "SidePanel_UpperG_46D_Inlay",
            "SidePanel_UpperG_46D_Panel",
            "SidePanel_UpperG_50D_Inlay",
            "SidePanel_UpperG_50D_Panel",
            "SidePanel_DoubleG_46D_Inlay",
            "SidePanel_DoubleG_46D_Panel",
            "SidePanel_DoubleG_50D_Inlay",
            "SidePanel_DoubleG_50D_Panel",
            "SidePanel_NoG_50H_46D_Panel",
            "SidePanel_NoG_53H_46D_Panel",
            "SidePanel_NoG_56H_46D_Panel",
            "SidePanel_NoG_50H_50D_Panel",
            "SidePanel_NoG_53H_50D_Panel",
            "SidePanel_NoG_56H_50D_Panel",
            "SidePanel_CenterG_46D_Panel_Overlay",
            "SidePanel_CenterG_50D_Pane_Overlay",
            "SidePanel_UpperG_46D_Pane_Overlay",
            "SidePanel_UpperG_50D_Pane_Overlay",
            "SidePanel_DoubleG_46D_Panel_Overlay",
            "SidePanel_DoubleG_50D_Panel_Overlay",
            "SidePanel_NoG_50H_46D_Panel_Overlay",
            "SidePanel_NoG_53H_46D_Panel_Overlay",
            "SidePanel_NoG_56H_46D_Panel_Overlay",
            "SidePanel_NoG_50H_50D_Panel_Overlay",
            "SidePanel_NoG_53H_50D_Panel_Overlay",
            "SidePanel_NoG_56H_50D_Panel_Overlay"
        ];
    }
}

export { RuleChangeCabinetColorSidePanel };
