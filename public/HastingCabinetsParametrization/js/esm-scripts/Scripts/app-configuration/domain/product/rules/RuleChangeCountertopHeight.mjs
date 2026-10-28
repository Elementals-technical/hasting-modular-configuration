import * as playcanvasStable_min from '../../../../../../playcanvas-stable.min.mjs';
import { app } from '../../../../../../playcanvas-stable.min.mjs';
import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { MeshRuleConfigBuilder } from '../../../helpers/mesh-rule-config-builder.mjs';
import { SceneTransformHelper } from '../../../helpers/scene-transform-helper.mjs';

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
 */ class RuleChangeCountertopHeight extends BaseProductRule {
    onInitialize() {
        const countertopOffsets = this.context.productConfig?.thicknessOffsets?.countertop;
        if (countertopOffsets) {
            this.dataCabinetUUniBox = {
                stretch: MeshRuleConfigBuilder.meshes([
                    'TopSolid'
                ]).breakpoints(Object.keys(countertopOffsets).map(Number)).values(countertopOffsets).build()
            };
        }
        LoggerService.log(this, `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`);
    }
    /**
     * Основне виконання правила.
     */ execute({ currentState, previousState }) {
        let thickness = currentState.get('Thickness');
        // На випадок, якщо атрибут не заповнений
        if (thickness === undefined || thickness === null || thickness === '') {
            LoggerService.log(this, '⚠️ [RuleApplyCabinetMaterial] CabinetColor is empty, skip');
            thickness = 0.5;
        // return;
        }
        // Якщо десь був parseInt – нормалізуємо, але зберігаємо як стрінгу
        // cabinetColor = назва матеріалу
        if (!this.dataCabinetUUniBox) {
            LoggerService.log(this, '⚠️ [Thickness-height-Countertop] No thickness config initialized, skip');
            return;
        }
        this._applyStretchY(thickness, this.dataCabinetUUniBox.stretch);
    }
    // ================== Пошук і завантаження матеріалу ==================
    _getApp() {
        // Контекст, як правило, містить entity; з неї беремо app
        if (this.context?.entity?.app) return this.context.entity.app;
        if (typeof playcanvasStable_min !== 'undefined' && app) return app; // fallback
        return null;
    }
    // ================== StretchY ==================
    _applyStretchY(thickness, entitiesByName) {
        const cfg = entitiesByName.values;
        let appliedCount = 0;
        const rootEntity = this.context?.entity;
        if (!rootEntity) return;
        const entities = SceneEntityHelper.collectByNamesIncludes(rootEntity, this.listNameMaterial);
        entities.forEach((entity)=>{
            const configForMesh = cfg[entity.name];
            if (!configForMesh) {
                LoggerService.log(this, '[RuleScaleWidth] No config for mesh name', {
                    entityName: entity.name
                });
                return;
            }
            const value = configForMesh[thickness];
            if (!value) {
                LoggerService.log(this, '[RuleScaleHeight] No value for thickness', {
                    entityName: entity.name,
                    thickness: thickness
                });
                return;
            }
            SceneTransformHelper.setStretch(entity, value);
            appliedCount++;
        });
        LoggerService.log(this, `✅ [RuleScale thickness] StretchY applied`, {
            thickness,
            appliedCount
        });
    }
    constructor(context){
        super({
            name: 'Thickness-height-Countertop',
            watchAttributes: [
                'Thickness'
            ],
            priority: 20
        }), // State
        _define_property(this, "_materialAssets", []);
        this.context = context;
        // Твої дані з таблиці
        this.listNameMaterial = [
            "TopSolid"
        ];
        // Твої дані з таблиці
        this.dataCabinetUUniBox = null; // буде ініціалізовано в onInitialize
    }
}

export { RuleChangeCountertopHeight };
