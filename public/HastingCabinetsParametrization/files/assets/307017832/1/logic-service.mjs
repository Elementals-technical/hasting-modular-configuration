import { Asset, Script } from 'playcanvas';

// import { BaseRule } from './../../core/Rule/base-rule/base-rule.mjs';

/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */
export class LogicService extends Script {

    static scriptName = 'logicService';

    initialize() {
        // this.activeRules = [];
        // this.configAccessor = null;
        // Правила не ініціалізуються тут, чекаємо виклику configure()
    }

    // /**
    //  * Метод налаштування, який викликає ProductController.
    //  * @param {object} configAccessor - Інтерфейс доступу до ConfigService.
    //  */
    configure() {
        // if (!configAccessor) {
        //     console.error(`[LogicService] Cannot configure: ConfigAccessor is missing.`);
        //     return;
        // }

        // this.configAccessor = configAccessor;
      
        // // 1. Спроба завантажити правила з атрибутів самого сервісу (Hybrid approach)
        // const rulesConfig = this._getRulesConfig();

        // if (rulesConfig && Array.isArray(rulesConfig)) {
        //     this.initRules(rulesConfig);
        // }
    }

    /**
     * Додає вже створене правило (наприклад, знайдений скрипт) до списку активних.
     * @param {object} ruleInstance 
     */
    addRule(ruleInstance) {
        // if (ruleInstance) {
        //     this.activeRules.push(ruleInstance);
        // }
    }

    /**
     * Парсинг конфігурації з доступних джерел (Asset або String).
     */
    _getRulesConfig() {
        // if (this.rulesAsset && this.rulesAsset.resource) {
        //     return this.rulesAsset.resource;
        // } else if (this.rulesJson) {
        //     try {
        //         return JSON.parse(this.rulesJson);
        //     } catch (e) {
        //         console.error(`[LogicService] Invalid JSON in rulesJson attribute:`, e);
        //     }
        // }
        // return null;
    }

    // /**
    //  * Ініціалізація правил з JSON-конфігурації.
    //  * Створює екземпляри BaseRule "на льоту" (Code-First instantiation).
    //  * @param {Array} rulesConfig 
    //  */
    initRules() {
      
        // rulesConfig.forEach(ruleJson => {
        //     try {
        //         // ВАЖЛИВО: Оскільки BaseRule це Script, ми передаємо параметри як об'єкт args.
        //         // BaseRule очікує: { app, entity, config, configAccessor }
        //         const ruleInstance = new BaseRule({
        //             app: this.app,
        //             entity: this.entity,
        //             config: ruleJson,       // Конфіг правила (conditions, actions)
        //             configAccessor: this.configAccessor
        //         });

        //         // Примусово викликаємо initialize, оскільки при ручному створенні через new() 
        //         // PlayCanvas не викликає його автоматично
        //         if (typeof ruleInstance.initialize === 'function') {
        //             ruleInstance.initialize();
        //         }

        //         this.activeRules.push(ruleInstance);
        //     } catch (err) {
        //         console.error(`[LogicService] Failed to create rule '${ruleJson.name}':`, err);
        //     }
        // });
    }
    /**
     * Called for enabled (running state) scripts on each tick.
     * @param {number} dt 
     */
    update(dt) {
    }
}
