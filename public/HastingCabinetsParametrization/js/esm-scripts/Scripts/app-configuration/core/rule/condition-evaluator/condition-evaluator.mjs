import { Script } from '../../../../../../playcanvas-stable.min.mjs';

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
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */ class ConditionEvaluator extends Script {
    /**
     * Called when the script is about to run for the first time.
     */ initialize() {
        console.log('[ConditionEvaluator] Service initialized');
    }
    /**
     * Перевіряє масив умов. Повертає true, якщо ВСІ умови виконані (AND).
     * @param {Array} conditions - Масив об'єктів умов [{ attribute: 'Width', comparator: '>', value: 100 }, ...]
     * @param {Object} currentState - Повний об'єкт поточного стану конфігурації
     * @param {string} [changedAttribute] - (Опціонально) Назва атрибута, який щойно змінився (для компаратора 'changed')
     * @returns {boolean}
     */ evaluateAll(conditions, currentState, changedAttribute) {
        // Якщо умов немає або масив порожній, вважаємо, що перевірка пройдена
        if (!conditions || conditions.length === 0) return true;
        // Використовуємо this.checkSingle, оскільки це метод класу
        return conditions.every((condition)=>{
            return this.checkSingle(condition, currentState, changedAttribute);
        });
    }
    /**
     * Перевірка однієї умови.
     * @param {Object} condition - Об'єкт умови
     * @param {Object} currentState 
     * @param {string} changedAttribute 
     * @returns {boolean}
     */ checkSingle(condition, currentState, changedAttribute) {
        const { comparator, attribute, value } = condition;
        // Отримуємо поточне значення атрибута зі стейту
        // Якщо атрибут не вказаний (наприклад для спец. перевірок), currentValue буде undefined
        const currentValue = attribute ? currentState[attribute] : undefined;
        switch(comparator){
            case 'changed':
                // Перевіряє, чи саме цей атрибут викликав оновлення
                // Корисно, коли правило має спрацьовувати ТІЛЬКИ при зміні конкретного поля,
                // а не просто коли умова істинна
                return attribute === changedAttribute;
            case '==':
                // Використовуємо нестроге порівняння, бо з UI можуть приходити стрічки "100", а в логіці числа 100
                return currentValue == value;
            case '!=':
                return currentValue != value;
            case '>':
                return Number(currentValue) > Number(value);
            case '<':
                return Number(currentValue) < Number(value);
            case '>=':
                return Number(currentValue) >= Number(value);
            case '<=':
                return Number(currentValue) <= Number(value);
            case 'oneOf':
                return Array.isArray(value) && value.includes(currentValue);
            default:
                console.warn(`[ConditionEvaluator] Unknown comparator: ${comparator} for attribute ${attribute}`);
                return false;
        }
    }
    /**
     * Called for enabled (running state) scripts on each tick.
     *
     * @param {number} dt - The delta time in seconds since the last frame.
     */ update(dt) {}
}
_define_property(ConditionEvaluator, "scriptName", 'conditionEvaluator');

export { ConditionEvaluator };
