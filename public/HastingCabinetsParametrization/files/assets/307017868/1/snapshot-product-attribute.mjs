
/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */
export class SnapshotProductAttribute {


    /**
     * Called when the script is about to run for the first time.
     */
    constructor(data) {
        // Клонуємо дані та заморожуємо їх. 
        // Це гарантує, що стан є єдиним і незмінним джерелом істини.
        this._params = Object.freeze({ ...data });
    }


    /**
     * Отримати значення параметра
     * @param {string} key 
     */
    get(key) {
        return this._params[key];
    }

    /**
     * Перевірити наявність ключа
     * @param {string} key 
     */
    has(key) {
        return key in this._params;
    }

    /**
     * Отримати всі дані
     */
    getAll() {
        return this._params;
    }

    /**
     * Основний метод для аналізу змін (Diffing).
     * Приймає об'єкт з потенційними змінами і повертає ТІЛЬКИ ті ключі,
     * значення яких реально відрізняються від поточних.
     * * @param {Object} proposedChanges - Нові значення
     * @returns {Object|null} Тільки реальні зміни або null
     */
    calculateDiff(proposedChanges) {
        const delta = {};
        let hasChanges = false;

        for (const key in proposedChanges) {
            const newValue = proposedChanges[key];
            const oldValue = this._params[key];

            // Використовуємо глибоке порівняння
            if (!SnapshotProductAttribute.areValuesEqual(oldValue, newValue)) {
                delta[key] = newValue;
                hasChanges = true;
            }
        }

        return hasChanges ? delta : null;
    }

    /**
     * Створює НОВИЙ знімок стану на основі змін.
     * Реалізує патерн "Єдиного стану":
     * Якщо змін немає -> повертає посилання на себе (this), не створюючи дублікатів.
     * * @param {Object} validChanges - Вже відфільтровані зміни (результат calculateDiff)
     */
    createNext(validChanges) {
        // Оптимізація: якщо змін немає або об'єкт пустий, не плодимо нові інстанси
        if (!validChanges || Object.keys(validChanges).length === 0) {
            return this;
        }

        const mergedData = { ...this._params, ...validChanges };
        return new SnapshotProductAttribute(mergedData);
    }

    /**
     * Статична утиліта для глибокого порівняння значень.
     * Підтримує Примітиви, Масиви та Об'єкти.
     */
    static areValuesEqual(v1, v2) {
        // 1. Суворе порівняння (включає примітиви та посилання)
        if (v1 === v2) return true;

        // 2. Перевірка типів та null
        if (typeof v1 !== typeof v2 || v1 === null || v2 === null) return false;

        // 3. Масиви (рекурсивно)
        if (Array.isArray(v1) && Array.isArray(v2)) {
            if (v1.length !== v2.length) return false;
            for (let i = 0; i < v1.length; i++) {
                if (!ProductConfigSnapshot.areValuesEqual(v1[i], v2[i])) return false;
            }
            return true;
        }

        // 4. Об'єкти (глибоке порівняння ключів рекурсивно)
        if (typeof v1 === 'object' && typeof v2 === 'object') {
            const keys1 = Object.keys(v1);
            const keys2 = Object.keys(v2);

            if (keys1.length !== keys2.length) return false;

            for (const key of keys1) {
                if (!keys2.includes(key)) return false;
                if (!ProductConfigSnapshot.areValuesEqual(v1[key], v2[key])) return false;
            }
            return true;
        }

        return false;
    }


}