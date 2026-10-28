import { LoggerService } from './../../../services/logger/logger-service.mjs';

/**
 * Виконавець правил для продукту.
 * Відповідає за:
 * - Реєстрацію правил
 * - Послідовне виконання правил при зміні store
 * - Управління життєвим циклом правил
 */
export class RuleExecutor {
    /**
     * @param {Object} context - Контекст виконання
     * @param {Object} context.app - PlayCanvas app
     * @param {Object} context.entity - Product entity
     * @param {string} context.productId - ID продукту
     */
    constructor(context, { strict = false } = {}) {
        this.context = context;
        // Legacy callers retain continue-on-error/queue semantics. Staging opts in.
        this.strict = strict;
        this.destroyed = false;
        this.rules = [];
        this.isExecuting = false;
        this.executionQueue = [];
        this._legacySuspended = false;
    }

    /**
     * Реєструє правило.
     * 
     * @param {BaseProductRule} rule - Інстанс правила
     */
    registerRule(rule) {
        if (this.strict) {
            this._assertAvailable();
            // Own partially initialized rules too: the configurator's cleanup must see them.
            this.rules.push(rule);
            rule.initialize(this.context);
            this.rules.sort((a, b) => a.priority - b.priority);
            return;
        }
         
        // Ініціалізуємо правило з контекстом
        rule.initialize(this.context);

        // Додаємо в список і сортуємо за пріоритетом
        this.rules.push(rule);
        this.rules.sort((a, b) => a.priority - b.priority);

        LoggerService.log(
            this,
            `🔧 [RuleExecutor] Registered rule "${rule.name}" (priority: ${rule.priority})`,
            { productId: this.context.productId, totalRules: this.rules.length }
        );
    }

    /**
     * Реєструє кілька правил одночасно.
     * 
     * @param {Array<BaseProductRule>} rules - Масив правил
     */
    registerRules(rules) {
         
        rules.forEach(rule => this.registerRule(rule));
    }

    /**
     * Виконує всі відповідні правила при зміні store.
     * Правила виконуються послідовно зверху вниз.
     * 
     * @param {Object} params
     * @param {Object} params.changes - Зміни в store
     * @param {Object} params.currentState - Поточний стан
     * @param {Object} params.previousState - Попередній стан
     */
    async executeRules({ changes, currentState, previousState }) {
        if (this._legacySuspended) throw Object.assign(new Error('Legacy product rules are suspended'), {code:'ULH_LEGACY_WRITE_UNSUPPORTED'});
        if (this.strict) this._assertAvailable();
         
        // Якщо вже виконуємо правила - додаємо в чергу
        if (this.isExecuting) {
            this.executionQueue.push({ changes, currentState, previousState });
            LoggerService.log(
                this,
                `⏸️ [RuleExecutor] Rules execution queued (already executing)`,
                { queueLength: this.executionQueue.length }
            );
            return;
        }

        this.isExecuting = true;

        try {
            await this._executeRulesInternal({ changes, currentState, previousState });

            // Виконуємо правила з черги
            while (this.executionQueue.length > 0) {
                const nextExecution = this.executionQueue.shift();
                await this._executeRulesInternal(nextExecution);
            }
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Внутрішній метод для виконання правил.
     * @private
     */
    async _executeRulesInternal({ changes, currentState, previousState }) {
        LoggerService.log(
            this,
            `⚙️ [RuleExecutor] Executing rules for "${this.context.productId}"`,
            { changes, rulesCount: this.rules.length }
        );

        const executedRules = [];

        // Виконуємо правила послідовно
        for (const rule of this.rules) {
            try {
                if (this.strict) this._assertNotCancelled();
                // Перевіряємо, чи має правило виконатись
                if (!rule.shouldExecute(changes, currentState, previousState)) {
                    LoggerService.log(
                        this,
                        `⏭️ [RuleExecutor] Skipping rule "${rule.name}" (condition not met)`
                    );
                    continue;
                }

                LoggerService.log(
                    this,
                    `▶️ [RuleExecutor] Executing rule "${rule.name}"`,
                    { priority: rule.priority }
                );

                // Виконуємо правило
                await rule.execute({ changes, currentState, previousState });
                if (this.strict) this._assertNotCancelled();

                executedRules.push(rule.name);

                LoggerService.log(
                    this,
                    `✅ [RuleExecutor] Rule "${rule.name}" executed successfully`
                );

            } catch (error) {
                if (this.strict) {
                    throw Object.assign(new Error(`Rule "${rule.name}": ${error?.message ?? error}`, { cause: error }), {
                        code: error?.code ?? 'PRODUCT_RULE_FAILED', ruleName: rule.name
                    });
                }
                LoggerService.log(
                    this,
                    `❌ [RuleExecutor] Error executing rule "${rule.name}":`,
                    error
                );
                console.error(`[RuleExecutor] Error in rule "${rule.name}":`, error);
                // Продовжуємо виконання інших правил
            }
        }

        LoggerService.log(
            this,
            `🏁 [RuleExecutor] Rules execution completed`,
            { executedRules, total: executedRules.length }
        );
    }

    /**
     * Отримує правило за назвою.
     * 
     * @param {string} name - Назва правила
     * @returns {BaseProductRule|undefined}
     */
    getRule(name) {
        return this.rules.find(rule => rule.name === name);
    }

    /**
     * Видаляє правило.
     * 
     * @param {string} name - Назва правила
     * @returns {boolean} - true якщо правило було видалено
     */
    removeRule(name) {
        const index = this.rules.findIndex(rule => rule.name === name);
        if (index !== -1) {
            const rule = this.rules[index];
            rule.destroy();
            this.rules.splice(index, 1);
            LoggerService.log(
                this,
                `🗑️ [RuleExecutor] Removed rule "${name}"`
            );
            return true;
        }
        return false;
    }

    /**
     * Очищує всі правила.
     */
    clearRules() {
        if (this.strict) return this._clearStrictRules();
        this.rules.forEach(rule => rule.destroy());
        this.rules = [];
        this.executionQueue = [];
        LoggerService.log(
            this,
            `🧹 [RuleExecutor] All rules cleared`
        );
    }

    /**
     * Знищення executor.
     */
    destroy() {
        if (this.strict) {
            if (this._destruction) return this._destruction;
            if (this.isExecuting) throw Object.assign(new Error('Rule executor is executing'), {code:'RULE_EXECUTOR_BUSY'});
            this.destroyed = true;
            this._destruction = this._clearStrictRules().finally(() => { this.context = null; });
            return this._destruction;
        }
        this.clearRules();
        this._legacyRecoveryResumes = null;
        this.context = null;
    }

    /** Keep the existing configured rule objects and meshes available for rollback. */
    suspendLegacy() {
        if (this.destroyed || this.isExecuting || this.executionQueue.length) {
            throw Object.assign(new Error('Legacy product rules are still active'), {code:'LEGACY_WRITERS_BUSY'});
        }
        if (this._legacySuspended) throw Object.assign(new Error('Legacy product rules already suspended'), {code:'LEGACY_HANDOFF_BUSY'});
        const resumes = [];
        try {
            for (const rule of this.rules) {
                if (rule._booleanInFlight) throw Object.assign(new Error('Legacy Boolean rule is still active'), {code:'LEGACY_WRITERS_BUSY'});
                if (typeof rule.suspendLegacy === 'function') resumes.push(rule.suspendLegacy());
            }
            this._legacySuspended = true;
        } catch (error) {
            const failed = [], errors = [];
            for (const resume of resumes.reverse()) {
                try { resume(); } catch (restoreError) { failed.push(resume); errors.push(restoreError); }
            }
            if (errors.length) {
                this._legacySuspended = true;
                this._legacyRecoveryResumes = failed;
                throw Object.assign(new AggregateError([error, ...errors], 'Legacy product rule rollback failed'),
                    {code:'LEGACY_HANDOFF_RECOVERY_REQUIRED'});
            }
            throw error;
        }
        let resumed = false;
        return () => {
            if (resumed) return;
            const failed = [];
            const errors = [];
            for (const resume of resumes.splice(0).reverse()) {
                try { resume(); } catch (error) { errors.push(error); failed.push(resume); }
            }
            resumes.push(...failed.reverse());
            if (errors.length) throw new AggregateError(errors, 'Legacy product rules could not resume');
            this._legacySuspended = false;
            resumed = true;
        };
    }

    _assertNotCancelled() {
        if (this.context?.signal?.aborted) throw Object.assign(new Error('Configuration cancelled'), {code:'CANCELLED'});
    }

    _assertAvailable() {
        if (this.destroyed) throw Object.assign(new Error('Rule executor destroyed'), {code:'RULE_EXECUTOR_DESTROYED'});
        if (this.isExecuting) throw Object.assign(new Error('Rule executor is executing'), {code:'RULE_EXECUTOR_BUSY'});
        this._assertNotCancelled();
    }

    async _clearStrictRules() {
        if (this.isExecuting) throw Object.assign(new Error('Rule executor is executing'), {code:'RULE_EXECUTOR_BUSY'});
        const rules = this.rules.splice(0).reverse(), errors = [];
        this.executionQueue = [];
        for (const rule of rules) {
            try { await rule.destroy(); } catch (error) { errors.push(error); }
        }
        if (errors.length) throw new AggregateError(errors, 'Product rule cleanup failed');
    }
}
