import { CABINET_CONFIG_TYPES, DRAWER_INNER_WIDTHS } from '../core/divider.constants.mjs';

// @ts-check
/**
 * @typedef {Object} RecommendationResult
 * @property {number} inputWidth - Ширина, яку ввів користувач
 * @property {boolean} isExactMatch - Чи співпадає ширина ідеально зі стандартом
 * @property {RecommendedPreset} recommended - Найкращий варіант
 * @property {RecommendedPreset[]} alternatives - Інші варіанти (менші/більші)
 */ /**
 * @typedef {Object} RecommendedPreset
 * @property {number} width - Стандартна ширина тумби (напр. 60)
 * @property {string} configType - Тип конфігурації
 * @property {number} diff - Різниця з введенням користувача (abs)
 * @property {'exact' | 'smaller' | 'larger'} relation - Як відноситься до вводу
 */ class DividerRecommendationAdapter {
    /**
     * Знаходить оптимальну конфігурацію на основі ширини та контексту.
     * @param {number} customWidth - Ширина від користувача (см)
     * @param {boolean} [hasSiphon=false] - Чи це шухляда під раковиною (Top drawer)
     * @returns {RecommendationResult}
     */ getRecommendation(customWidth, hasSiphon = false) {
        // 1. Визначаємо тип конфігурації
        const targetType = hasSiphon ? CABINET_CONFIG_TYPES.STANDARD_WIDTH_SIPHON : CABINET_CONFIG_TYPES.STANDARD_FULL;
        // 2. Знаходимо найближчу ширину
        const closestWidth = this._findClosestWidth(customWidth);
        // 3. Формуємо основну рекомендацію
        const recommended = this._createPreset(closestWidth, customWidth, targetType);
        // 4. Шукаємо альтернативи (найближчі сусіди)
        // Наприклад, для 58см: рекомендуємо 60см, але показуємо 50см як альтернативу
        const alternatives = this.availableWidths.filter((w)=>w !== closestWidth).map((w)=>this._createPreset(w, customWidth, targetType)).sort((a, b)=>a.diff - b.diff) // Сортуємо за близькістю
        .slice(0, 3); // Беремо топ-3 альтернативи
        return {
            inputWidth: customWidth,
            isExactMatch: recommended.diff === 0,
            recommended,
            alternatives
        };
    }
    /**
     * Повертає список всіх можливих пресетів для дропдауну в UI
     * @param {boolean} [hasSiphon=false]
     */ getAllPresets(hasSiphon = false) {
        const type = hasSiphon ? CABINET_CONFIG_TYPES.STANDARD_WIDTH_SIPHON : CABINET_CONFIG_TYPES.STANDARD_FULL;
        return this.availableWidths.map((width)=>({
                width,
                label: `${width} cm (${hasSiphon ? 'With Siphon' : 'Full Drawer'})`,
                type,
                value: width // для <option value="...">
            }));
    }
    // ==========================================
    // PRIVATE HELPERS
    // ==========================================
    /**
     * Знаходить найближче число в масиві доступних ширин
     * @private
     * @param {number} target 
     * @returns {number}
     */ _findClosestWidth(target) {
        return this.availableWidths.reduce((prev, curr)=>{
            return Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev;
        });
    }
    /**
     * Створює об'єкт пресету
     * @private
     * @returns {RecommendedPreset}
     */ _createPreset(standardWidth, userWidth, type) {
        const diff = Math.abs(standardWidth - userWidth);
        let relation = /** @type {'exact' | 'smaller' | 'larger'} */ 'exact';
        if (standardWidth < userWidth) relation = 'smaller';
        if (standardWidth > userWidth) relation = 'larger';
        return {
            width: standardWidth,
            configType: type,
            diff,
            relation
        };
    }
    constructor(){
        // Отримуємо список доступних ширин: [25, 35, 50, 60, ...]
        this.availableWidths = Object.keys(DRAWER_INNER_WIDTHS).map(Number).sort((a, b)=>a - b);
    }
}

export { DividerRecommendationAdapter };
