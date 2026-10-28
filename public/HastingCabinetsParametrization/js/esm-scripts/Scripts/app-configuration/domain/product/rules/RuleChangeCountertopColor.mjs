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
 */ class RuleChangeCountertopColor extends BaseProductRule {
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
     */ execute({ currentState, previousState }) {
        let rawValue = currentState.get('CountertopColor');
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
            prev: previousState?.get('CountertopColor')
        });
        // Якщо матеріал не змінився – можна скіпнути
        if (this._lastMaterialName === cabinetColor) {
            LoggerService.log(this, 'ℹ️ [RuleApplyCabinetMaterial] Material not changed, skip reapply', {
                cabinetColor
            });
            return;
        }
        this._applyMaterialByName(cabinetColor);
    }
    // ================== Пошук і завантаження матеріалу ==================
    async _applyMaterialByName(materialName) {
        const rootEntity = this.context?.entity;
        if (!rootEntity) return;
        const entities = SceneEntityHelper.collectByNames(rootEntity, this.listNameMaterial);
        MaterialService.applyMaterialByName(materialName, entities.flat());
    }
    constructor(context){
        super({
            name: 'ChangeCountertopColor',
            watchAttributes: [
                'CountertopColor',
                'sinkType'
            ],
            priority: 20
        }), // State
        _define_property(this, "_materialAssets", []);
        this.context = context;
        // Твої дані з таблиці
        this.listNameMaterial = [
            "TopSolid",
            "Sink_HPLCover",
            "Sink_HPLPrisma",
            "Sink_HPLQuadra",
            "Sink_HPLStrip"
        ];
    }
}

export { RuleChangeCountertopColor };
