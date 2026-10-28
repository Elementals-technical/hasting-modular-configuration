import { Script } from 'playcanvas';

/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */
export class LoggerService extends Script {

    static scriptName = 'loggerService';

    initialize() {
 
        // 1. Зберігаємо посилання на цей екземпляр у статичне поле
        // Це дозволяє звертатися до сервісу без this.app
        LoggerService.instance = this;

        this.config = {
            enabled: true,         // Глобальний вимикач
            showTimestamp: true,   // Чи показувати час
            debugTrace: false      // Якщо true - показує повний шлях до файлу (повільніше)
        };

        this.log(this, "📝 LoggerService initialized (Singleton Mode)");
    }

    // --- СТАТИЧНІ МЕТОДИ (Для виклику звідусіль) ---

    static log(context, message, ...args) {
        if (LoggerService.instance) {
            LoggerService.instance.log(context, message, ...args);
        } else {
            // Фолбек, якщо PlayCanvas ще не ініціалізував сервіс
            // console.log(`[PRE-INIT] ${message}`, ...args);
        }
    }

    static warn(context, message, ...args) {
        if (LoggerService.instance) {
            LoggerService.instance.warn(context, message, ...args);
        } else {
            // console.warn(`[PRE-INIT] ${message}`, ...args);
        }
    }

    static error(context, message, ...args) {
        if (LoggerService.instance) {
            LoggerService.instance.error(context, message, ...args);
        } else {
            // console.error(`[PRE-INIT] ${message}`, ...args);
        }
    }

    // --- МЕТОДИ ЕКЗЕМПЛЯРА (Реальна логіка) ---

    /**
     * Основний метод логування
     * @param {Object|string} context - 'this' (інстанс скрипта) або рядок назви контексту
     * @param {string} message - Текст повідомлення
     * @param {...any} args - Додаткові дані (об'єкти, масиви)
     */
    log(context, message, ...args) {
        this._print('log', context, message, args);
    }

    warn(context, message, ...args) {
        this._print('warn', context, message, args);
    }

    error(context, message, ...args) {
        this._print('error', context, message, args);
    }

    _print(level, context, message, args) {
        if (!this.config.enabled) return;

        // 1. Визначаємо назву контексту (Скрипта)
        let contextName = 'Global';
        if (typeof context === 'string') {
            contextName = context;
        } else if (context) {
            // Спробуємо взяти ім'я скрипта (attrName) або ім'я класу
            contextName = context.attrName || context.constructor.name || 'Unknown';
        }

        // 2. Формуємо префікси
        const time = this.config.showTimestamp ? `[${new Date().toLocaleTimeString()}]` : '';
        const prefix = `${time} [${contextName}]`;

        // 3. Стилізація (CSS для консолі)
        const colors = {
            log: 'color: #00AAFF; font-weight: bold;',   // Блакитний
            warn: 'color: #FFAA00; font-weight: bold;',  // Помаранчевий
            error: 'color: #FF0000; font-weight: bold;'  // Червоний
        };

        // 4. Опціонально: Шлях до файлу (Stack Trace)
        // Це дорога операція, тому використовуємо обережно або тільки для помилок
        if (this.config.debugTrace || level === 'error') {
            // Невеликий хак щоб отримати рядок виклику
            const stack = new Error().stack;
            if (stack) {
                // Парсинг залежить від браузера, беремо 3-й рядок (приблизно)
                const traceLine = stack.split('\n')[3];
                if (traceLine) {
                    args.push(`\n📍 Source: ${traceLine.trim()}`);
                }
            }
        }

        // 5. Вивід
        // %c дозволяє стилізувати перший аргумент
        console[level](`%c${prefix}`, colors[level], message, ...args);
    }

    onDestroy() {
        if (LoggerService.instance === this) {
            LoggerService.instance = null;
        }
    }

    /**
     * Called for enabled (running state) scripts on each tick.
     *
     * @param {number} dt - The delta time in seconds since the last frame.
     */
    update(dt) {
    }
}
