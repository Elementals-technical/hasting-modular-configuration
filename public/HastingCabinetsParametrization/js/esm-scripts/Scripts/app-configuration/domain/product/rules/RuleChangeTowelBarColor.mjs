import * as playcanvasStable_min from '../../../../../../playcanvas-stable.min.mjs';
import { app } from '../../../../../../playcanvas-stable.min.mjs';
import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';

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
 * Правило зміни кольору/матеріалу TowelBar.
 *
 * Реагує на зміни атрибута 'TowelBarColor' в store.
 * Застосовує матеріал до всіх TowelBar entities (Left та Right).
 * Це глобальне правило - один матеріал для обох ручок.
 */ class RuleChangeTowelBarColor extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `📏 [RuleChangeTowelBarColor] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        let rawValue = currentState.get('TowelBarColor');
        // На випадок, якщо атрибут не заповнений
        if (rawValue === undefined || rawValue === null || rawValue === '') {
            LoggerService.log(this, '⚠️ [RuleChangeTowelBarColor] TowelBarColor is empty, skip');
            return;
        }
        // Нормалізуємо назву матеріалу
        const towelBarColor = String(rawValue).trim();
        LoggerService.log(this, '🎨 [RuleChangeTowelBarColor] Executing', {
            rawValue,
            normalized: towelBarColor,
            prev: previousState?.get('TowelBarColor')
        });
        // Якщо матеріал не змінився – можна скіпнути
        if (this._lastMaterialName === towelBarColor) {
            LoggerService.log(this, 'ℹ️ [RuleChangeTowelBarColor] Material not changed, skip reapply', {
                towelBarColor
            });
            return;
        }
        this._applyMaterialByName(towelBarColor);
    }
    // ================== Пошук і завантаження матеріалу ==================
    _getApp() {
        // Контекст, як правило, містить entity; з неї беремо app
        if (this.context?.entity?.app) return this.context.entity.app;
        if (typeof playcanvasStable_min !== 'undefined' && app) return app; // fallback
        return null;
    }
    _applyMaterialByName(materialName) {
        const app = this._getApp();
        if (!app) {
            LoggerService.log(this, '❌ [RuleChangeTowelBarColor] App not found in context');
            return;
        }
        // Пошук матеріалу по імені серед material-assets
        const matAsset = app.assets.find(materialName, 'material');
        if (!matAsset) {
            LoggerService.log(this, '❌ [RuleChangeTowelBarColor] Material asset not found by name', {
                materialName
            });
            return;
        }
        // Якщо ресурс уже завантажений – застосовуємо одразу
        if (matAsset.resource) {
            if (matAsset.resource._assetReferences?.diffuseMap?.asset) {
                matAsset.resource._assetReferences.diffuseMap.asset.ready((data)=>{
                    this._lastMaterialName = materialName;
                    this._applyMaterialResource(matAsset.resource, materialName);
                });
            } else {
                this._lastMaterialName = materialName;
                this._applyMaterialResource(matAsset.resource, materialName);
            }
        }
        app.assets.load(matAsset);
        // Lazy load
        matAsset.ready((loadedAsset)=>{
            // Якщо за цей час користувач уже змінив колір – не перезатираємо
            if (this._lastMaterialName && this._lastMaterialName !== materialName) {
                LoggerService.log(this, 'ℹ️ [RuleChangeTowelBarColor] Material changed while loading, skip apply', {
                    requested: materialName,
                    current: this._lastMaterialName
                });
                return;
            }
            if (matAsset.resource._assetReferences?.diffuseMap?.asset) {
                matAsset.resource._assetReferences.diffuseMap.asset.ready((data)=>{
                    this._lastMaterialName = materialName;
                    this._applyMaterialResource(loadedAsset.resource, materialName);
                });
            } else {
                this._lastMaterialName = materialName;
                this._applyMaterialResource(loadedAsset.resource, materialName);
            }
        });
    }
    // ================== Застосування до ентіті ==================
    _applyMaterialResource(materialResource, materialName) {
        const rootEntity = this.app.root;
        // Збираємо всі entities з назвами з listNameMaterial (шукаємо глобально від root)
        const entities = SceneEntityHelper.collectByNames(rootEntity, this.listNameMaterial);
        if (entities.length === 0) {
            LoggerService.warn(this, '⚠️ [RuleChangeTowelBarColor] No entities found matching listNameMaterial', {
                listNameMaterial: this.listNameMaterial
            });
            return;
        }
        let appliedCount = 0;
        entities.forEach((entity)=>{
            let changed = false;
            // Новий рендер-компонент
            if (entity.render && entity.render.meshInstances) {
                entity.render.meshInstances.forEach((mi)=>{
                    mi.material = materialResource;
                    changed = true;
                });
            }
            // Старий model-компонент (на всяк випадок)
            if (entity.model && entity.model.meshInstances) {
                entity.model.meshInstances.forEach((mi)=>{
                    mi.material = materialResource;
                    changed = true;
                });
            }
            // Якщо матеріал змінено – тригеримо пов'язані скрипти
            if (changed && entity.script) {
                // TriPlanarMapping
                if (entity.script.triPlanarMapping && typeof entity.script.triPlanarMapping.refreshMaterials === 'function') {
                    entity.script.triPlanarMapping.refreshMaterials();
                }
                // SmartStretch
                if (entity.script.smartStretch && typeof entity.script.smartStretch.refreshMaterials === 'function') {
                    entity.script.smartStretch.refreshMaterials();
                }
                // MeshBoolean
                if (entity.script.meshBoolean && typeof entity.script.meshBoolean.performBoolean === 'function') {
                    entity.script.meshBoolean.performBoolean();
                }
            }
            if (changed) {
                appliedCount++;
            }
        });
        LoggerService.log(this, '✅ [RuleChangeTowelBarColor] Material applied', {
            materialName,
            appliedCount,
            entitiesFound: entities.length
        });
    }
    constructor(context){
        super({
            name: 'ChangeTowelBarColor',
            watchAttributes: [
                'TowelBarColor'
            ],
            priority: 20
        }), // State
        _define_property(this, "_materialAssets", []);
        this.context = context;
        // Список імен mesh entities всередині TowelBar_Left/TowelBar_Right
        // ВАЖЛИВО: Це імена mesh entities всередині TowelBar40_R template
        // Якщо TowelBar40_R має певну структуру, вкажіть правильні імена
        this.listNameMaterial = [
            "TowelBar40_R1" // Або ім'я mesh entity всередині TowelBar40_R
        ];
    }
}

export { RuleChangeTowelBarColor };
