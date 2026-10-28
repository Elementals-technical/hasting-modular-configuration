/**
 * InteractionLogger — записує виклики ConfiguratorAPI для тестування та дебагінгу.
 *
 * Кожен запис містить: таймстемп, назву методу, аргументи, результат.
 * Лог можна експортувати як відтворюваний JS скрипт.
 *
 * @example
 * ConfiguratorAPI.logger.getLog()    // масив записів
 * ConfiguratorAPI.logger.export()    // відтворюваний скрипт
 * ConfiguratorAPI.logger.clear()     // очистити
 */
export class InteractionLogger {

    constructor() {
        this._log = [];
        this._enabled = true;
        this._startTime = Date.now();
    }

    record(method, args, result) {
        if (!this._enabled) return;
        try {
            this._log.push({
                t: Date.now() - this._startTime,
                method,
                args: JSON.parse(JSON.stringify(args)),
                result: result !== undefined ? JSON.parse(JSON.stringify(result)) : undefined
            });
        } catch {
            // circular reference — зберігаємо без глибокого клону
            this._log.push({ t: Date.now() - this._startTime, method, args: ['[unserializable]'] });
        }
    }

    getLog() { return this._log; }

    clear() {
        this._log = [];
        this._startTime = Date.now();
    }

    enable() { this._enabled = true; }
    disable() { this._enabled = false; }

    export() {
        return this._log.map(entry => {
            const argsStr = entry.args.map(a => JSON.stringify(a)).join(', ');
            return `await ConfiguratorAPI.${entry.method}(${argsStr});`;
        }).join('\n');
    }

    /**
     * Обгортає методи об'єкта для автоматичного логування.
     * @param {object} api — об'єкт з методами (ConfiguratorAPI)
     * @param {string[]} methodNames — масив назв методів для логування
     */
    wrapMethods(api, methodNames) {
        for (const name of methodNames) {
            if (typeof api[name] !== 'function') continue;
            const original = api[name];
            const logger = this;
            api[name] = async function (...args) {
                const result = await original.apply(this, args);
                logger.record(name, args, result);
                return result;
            };
        }
    }
}
