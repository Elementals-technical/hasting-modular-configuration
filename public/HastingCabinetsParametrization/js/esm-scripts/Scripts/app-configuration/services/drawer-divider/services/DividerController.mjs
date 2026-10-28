import { DividerCalculator } from '../core/DividerCalculator.mjs';
import { DividerDefinitions } from '../core/DividerDefinitions.mjs';
import { DividerDebugLogger } from '../diagnostics/DividerDebugLogger.mjs';

// @ts-check
/**
 * Цей клас - це "Фасад" для UI.
 * Він перетворює сирі дані в зручний для рендеру формат (View Model).
 */ class DividerController {
    /**
     * Отримати всі слоти (occupied + ghost) для поточної конфігурації
     * @param {number} width - Ширина тумби в см (60, 80, 90, 120)
     * @param {string} drawerKey - Ключ шухляди ('Top', 'Bot')
     * @param {Object} currentState - Поточний стан дівайдерів (опціонально)
     * @returns {Object} Структура { zones: { zoneName: { slots: [...] } } }
     */ getAllSlots(width, drawerKey, currentState = {}) {
        const configType = DividerDefinitions.getConfigType(drawerKey);
        const traceId = DividerDebugLogger.nextTraceId('divider-controller');
        DividerDebugLogger.log('Controller.getAllSlots', 'Calculation requested', {
            traceId,
            width,
            drawerKey,
            configType,
            currentState: DividerDebugLogger.summarizeCompactState(currentState)
        });
        const result = this.calculator.getAllPotentialSlots(width, configType, currentState);
        DividerDebugLogger.log('Controller.getAllSlots', 'Calculation completed', {
            traceId,
            width,
            drawerKey,
            configType,
            result: DividerDebugLogger.summarizeDrawerConfig(result)
        });
        return result;
    }
    constructor(){
        this.calculator = new DividerCalculator();
    }
}

export { DividerController };
