import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { MaterialService } from '../../../../services/material/material-service.mjs';

/**
 * Правило масштабування продукту по ширині.
 * 
 * Реагує на зміни атрибута 'Width' в store.
 * Застосовує відповідний крок масштабування до всіх дочірніх entities з певними тегами.
 */
export class RuleChangeSlinkColor extends BaseProductRule {
    // State
    _materialAssets = [];
    _lastAppliedColor = null;

    constructor(context) {


        super({
            name: 'ChangeSlinkColor',
            watchAttributes: ['CountertopColor', 'sinkType', 'VesselColor'],
            priority: 20
        });

        this.context = context;

        // Твої дані з таблиці
        this.listNameMaterial = [
            "TopSolid",
            "Sink_HPLCover",
            "Sink_HPLPrisma",
            "Sink_HPLQuadra",
            "Sink_HPLStrip",
        ]


    }
    collectMaterials() {


        this._materialAssets = [];
        const seenIds = new Set();

        this._materialTags.forEach(tag => {
            // findByTag gets metadata even if asset is not loaded (Preload: false)
            const assets = this.app.assets.findByTag(tag);
            assets.forEach(a => {
                if (a.type === 'material' && !seenIds.has(a.id)) {
                    this._materialAssets.push(a);
                    seenIds.add(a.id);
                }
            });
        });

        this._materialAssets.sort((a, b) => a.name.localeCompare(b.name));
    }
    onInitialize() {


        LoggerService.log(
            this,
            `📏 [RuleScaleHeight] Initialized for product "${this.productId}"`
        );
    }

    /**
     * Основне виконання правила.
     */
    execute({ currentState }) {
        const sinkType = currentState.get('sinkType') || '';
        const isVessel = sinkType === 'Vessel' || sinkType.startsWith('Vessel_');

        let color;
        if (isVessel) {
            const vesselColor = currentState.get('VesselColor');
            color = vesselColor || currentState.get('CountertopColor');
        } else {
            color = currentState.get('CountertopColor');
        }

        if (!color) {
            LoggerService.log(this, '⚠️ [RuleChangeSlinkColor] No color resolved, skip');
            return;
        }

        const resolved = String(color).trim();

        // Пропускаємо якщо колір не змінився (захист від перезапису при нерелевантних змінах)
        if (resolved === this._lastAppliedColor) return;
        this._lastAppliedColor = resolved;

        this._applyMaterialByName(resolved);
    }


    // ================== Пошук і завантаження матеріалу ==================



    async _applyMaterialByName(materialName) {
        const listAsset = this.context?.entity.findByTag('basin_sink');

        await MaterialService.applyMaterialByName(materialName, listAsset.flat());
    }

}
