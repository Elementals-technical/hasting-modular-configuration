/**
 * Базовий клас для всіх composition rules.
 * 
 * Composition Rules працюють на рівні всієї композиції (міжпродуктова логіка):
 * - Агрегують дані з кількох продуктів
 * - Застосовують зміни до глобальних об'єктів (стільниця, підлога, стіни)
 * - Виконуються останніми після всіх product rules
 */
export class BaseCompositionRule {
    /**
     * @param {Object} config - Конфігурація правила
     * @param {string} config.name - Назва правила
     * @param {Array<string>} config.watchCompositions - Які композиції відстежувати
     * @param {Array<string>} config.watchParams - Які параметри відстежувати
     */
    constructor(config) {
        this.name = config?.name || this.constructor.name;
        this.watchCompositions = config?.watchCompositions || [];
        this.watchParams = config?.watchParams || [];
        this.enabled = true;
    }

    /**
     * Агрегація даних з композицій
     * @param {Object} compositions - Об'єкт з композиціями (Map<compositionId, CompositionStore>)
     * @returns {Object} - Агреговані дані
     */
    aggregateFn(compositions) {
        throw new Error(`${this.name}: aggregateFn() must be implemented`);
    }

    /**
     * Застосування змін на основі агрегованих даних
     * @param {Object} result - Результат aggregateFn()
     * @param {Object} context - Контекст виконання
     * @param {pc.Application} context.app - PlayCanvas app instance
     * @param {string} context.compositionId - ID композиції що змінилась
     * @param {Object} context.changes - Об'єкт змін (якщо є)
     * @param {boolean} context.structureChanged - Чи змінилась структура
     */
    async applyFn(result, context) {
        throw new Error(`${this.name}: applyFn() must be implemented`);
    }

    /**
     * Конвертує правило в конфіг для SceneAggregator
     * @returns {Object} - Конфіг handler'а
     */
    toHandlerConfig() {
        return {
            watchCompositions: this.watchCompositions,
            watchParams: this.watchParams,
            aggregateFn: this.aggregateFn.bind(this),
            applyFn: this.applyFn.bind(this)
        };
    }
}
