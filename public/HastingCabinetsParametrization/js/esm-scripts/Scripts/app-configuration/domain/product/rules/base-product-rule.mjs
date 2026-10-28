import { SceneEntityHelper } from '../../../helpers/scene-entity-helper.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';

/**
 * Базовий клас для всіх правил продукту.
 *
 * Кожне правило:
 * - Реагує на зміни конфігурації продукту
 * - Виконує бізнес-логіку
 * - Має доступ до PlayCanvas API через context
 * - Виконується послідовно з іншими правилами
 */ class BaseProductRule {
    /**
     * Ініціалізація правила з контекстом виконання.
     * Викликається один раз при створенні.
     *
     * @param {Object} context
     * @param {Object} context.app - PlayCanvas app instance
     * @param {Object} context.entity - Product entity
     * @param {string} context.productId - ID продукту
     */ initialize(context) {
        this.context = context;
        this.onInitialize();
    }
    /**
     * Hook для кастомної ініціалізації в дочірніх класах.
     * Перевизначається в конкретних правилах.
     */ onInitialize() {
    // Override in child classes
    }
    /**
     * Перевіряє, чи має правило виконатись при поточних змінах.
     *
     * @param {Object} changes - Об'єкт зі зміненими атрибутами
     * @param {Object} currentState - Поточний стан продукту
     * @param {Object} previousState - Попередній стан продукту
     * @returns {boolean}
     */ shouldExecute(changes, currentState, previousState) {
        if (!this.enabled) return false;
        // Якщо не вказані watchAttributes - спрацьовує на будь-які зміни
        if (this.watchAttributes.length === 0) return true;
        // Перевіряємо, чи є зміни в атрибутах, які нас цікавлять
        return this.watchAttributes.some((attr)=>attr in changes);
    }
    /**
     * Основний метод виконання правила.
     * ОБОВ'ЯЗКОВО має бути перевизначений в дочірніх класах.
     *
     * @param {Object} params
     * @param {Object} params.changes - Зміни, що викликали правило
     * @param {Object} params.currentState - Поточний стан продукту
     * @param {Object} params.previousState - Попередній стан продукту
     * @returns {void|Promise<void>}
     */ execute({ changes, currentState, previousState }) {
        throw new Error(`Rule "${this.name}" must implement execute() method`);
    }
    /**
     * Applies a breakpoint configuration to every matching product entity.
     * Missing entities and null/undefined values are reported; missing values are skipped.
     * Callbacks run synchronously and must bind their own receiver when needed.
     * @param {string|number} key
     * @param {{ values: Object }} configuration
     * @param {function(Object, *): *} applyValue
     * @returns {boolean} Whether every required entity and value was applied successfully.
     */ _applyTransformConfig(key, configuration, applyValue) {
        const valuesByName = configuration.values;
        const names = Object.keys(valuesByName);
        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const foundNames = new Set(entities.map((entity)=>entity.name));
        let applied = true;
        for (const name of names){
            if (!foundNames.has(name)) {
                applied = false;
                LoggerService.warn(this, "Product rule entity not found", {
                    productId: this.productId,
                    entityName: name
                });
            }
        }
        for (const entity of entities){
            const value = valuesByName[entity.name]?.[key];
            if (value === undefined || value === null) {
                applied = false;
                LoggerService.warn(this, "Product rule configuration value missing", {
                    entityName: entity.name,
                    key
                });
                continue;
            }
            if (applyValue(entity, value) === null) applied = false;
        }
        return applied;
    }
    /**
     * Допоміжний метод для отримання app instance.
     */ get app() {
        return this.context?.app;
    }
    /**
     * Допоміжний метод для отримання entity.
     */ get entity() {
        return this.context?.entity;
    }
    /**
     * Допоміжний метод для отримання productId.
     */ get productId() {
        return this.context?.productId;
    }
    /**
     * Увімкнути правило.
     */ enable() {
        this.enabled = true;
    }
    /**
     * Вимкнути правило.
     */ disable() {
        this.enabled = false;
    }
    /**
     * Cleanup при знищенні правила.
     */ destroy() {
        this.context = null;
    }
    /**
     * @param {Object} config - Конфігурація правила
     * @param {string} config.name - Назва правила
     * @param {Array<string>} config.watchAttributes - Атрибути, на які реагує правило
     * @param {number} config.priority - Пріоритет виконання (менше = раніше)
     */ constructor(config){
        this.name = config?.name || this.constructor.name;
        this.watchAttributes = config?.watchAttributes || [];
        this.priority = config?.priority || 100;
        this.enabled = true;
        // Context буде встановлений при реєстрації
        this.context = null;
    }
}

export { BaseProductRule };
