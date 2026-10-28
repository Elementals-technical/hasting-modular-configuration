import { BaseProductRule } from './base-product-rule.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';

/**
 * Приклад правила для валідації параметрів продукту.
 * 
 * Демонструє:
 * - Правило без watchAttributes (спрацьовує на будь-які зміни)
 * - Найвищий пріоритет (виконується першим)
 * - Можливість блокувати невалідні зміни
 */ class RuleValidateProduct extends BaseProductRule {
    onInitialize() {
        LoggerService.log(this, `✅ [RuleValidateProduct] Initialized with constraints`, this._constraints);
    }
    /**
     * Перевизначаємо shouldExecute для власної логіки.
     */ shouldExecute(changes, currentState, previousState) {
        // Виконуємось завжди, якщо є зміни
        return Object.keys(changes).length > 0;
    }
    /**
     * Валідація змін.
     */ execute({ changes, currentState, previousState }) {
        LoggerService.log(this, `🔍 [RuleValidateProduct] Validating changes`, {
            changes
        });
        // Перевіряємо кожну зміну
        for (const [key, value] of Object.entries(changes)){
            const constraint = this._constraints[key];
            if (constraint) {
                if (value < constraint.min || value > constraint.max) {
                    LoggerService.log(this, `❌ [RuleValidateProduct] Invalid value for "${key}": ${value}`, {
                        constraint
                    });
                    // В реальному випадку тут можна:
                    // - Відкинути зміну
                    // - Виправити значення
                    // - Кинути помилку
                    console.warn(`[RuleValidateProduct] Value ${value} for "${key}" is out of range [${constraint.min}, ${constraint.max}]`);
                }
            }
        }
        LoggerService.log(this, `✅ [RuleValidateProduct] Validation completed`);
    }
    constructor(){
        super({
            name: 'ValidateProduct',
            watchAttributes: [],
            priority: 1 // Найвищий пріоритет - виконується першим
        });
        // Обмеження параметрів
        this._constraints = {
            width: {
                min: 25,
                max: 120
            },
            height: {
                min: 50,
                max: 56
            },
            depth: {
                min: 40,
                max: 60
            }
        };
    }
}

export { RuleValidateProduct };
