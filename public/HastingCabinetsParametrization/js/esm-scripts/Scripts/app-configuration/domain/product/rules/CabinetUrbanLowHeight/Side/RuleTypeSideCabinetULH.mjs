import { BaseProductRule } from '../../base-product-rule.mjs';
import { LoggerService } from '../../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../../helpers/scene-transform-helper.mjs';
import { SceneBooleanHelper } from '../../../../../helpers/scene-boolean-helper.mjs';

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
/** ULH side cabinet visibility and Boolean setup with isolated execution and legacy retry support. */ class RuleTypeSideCabinetULH extends BaseProductRule {
    async execute() {
        // Стан "вимкнено" фіксуємо одразу — до відкладеного runOnStart-вирізання
        // самого meshBoolean (через 6 кадрів після initialize).
        this._lockDisabledTargets();
        this._applyVisibility();
        if (this._applied) return;
        await this._runBoolean();
    }
    async _runBoolean() {
        // Не запускаємо паралельно: execute і retry можуть збігтися.
        if (this._booleanInFlight) return this._booleanInFlight;
        this._booleanInFlight = (async ()=>{
            try {
                this._applied = await this._applyBooleanConfig(this.configurationKey);
            } catch (error) {
                LoggerService.error(this, `[${this.name}] Boolean failed`, error);
                this._applied = false;
                if (this.context?.executionMode === 'isolated') throw error;
            } finally{
                // SceneBooleanHelper hides cutters; restore the explicit visibility table even on failure.
                this._applyVisibility();
            }
            LoggerService.log(this, `✅ [${this.name}] Boolean ${this._applied ? 'applied' : 'pending'}`, {
                attempt: this._retryAttempts
            });
            if (!this._applied) {
                if (this.context?.executionMode === 'isolated') {
                    throw Object.assign(new Error('Isolated product Boolean is not ready'), {
                        code: 'CONFIGURATION_BOOLEAN_PENDING'
                    });
                }
                this._scheduleRetry();
            }
        })();
        try {
            await this._booleanInFlight;
        } finally{
            this._booleanInFlight = null;
        }
    }
    /**
     * Правило виконується лише на зміни атрибутів. Якщо на першому запуску mesh ще не
     * завантажений, без повтору Boolean так і лишився б не застосованим.
     */ _scheduleRetry() {
        if (this._legacySuspended) return;
        // An isolated transaction owns and awaits all work; it cannot leave an app update retry behind.
        if (this.context?.executionMode === 'isolated') return;
        const app = this.app;
        if (!app || this._retryHandle) return;
        if (this._retryAttempts >= RuleTypeSideCabinetULH.MAX_RETRY_ATTEMPTS) {
            LoggerService.warn(this, `[${this.name}] Boolean not applied after retries`, {
                productId: this.productId,
                attempts: this._retryAttempts
            });
            return;
        }
        let frames = RuleTypeSideCabinetULH.RETRY_DELAY_FRAMES;
        const onUpdate = ()=>{
            if (--frames > 0) return;
            app.off('update', onUpdate);
            this._retryHandle = null;
            // Продукт видалено або правило вже спрацювало.
            if (!this.entity?.parent || this._applied) return;
            this._retryAttempts++;
            this._lockDisabledTargets();
            this._runBoolean();
        };
        this._retryHandle = onUpdate;
        app.on('update', onUpdate);
    }
    destroy() {
        if (this._retryHandle) {
            this.app?.off('update', this._retryHandle);
            this._retryHandle = null;
        }
        super.destroy?.();
    }
    suspendLegacy() {
        if (this._booleanInFlight) throw Object.assign(new Error('ULH Boolean is still running'), {
            code: 'LEGACY_WRITERS_BUSY'
        });
        const hadRetry = Boolean(this._retryHandle);
        if (hadRetry) this.app?.off('update', this._retryHandle);
        this._retryHandle = null;
        this._legacySuspended = true;
        let resumed = false;
        return ()=>{
            if (resumed) return;
            this._legacySuspended = false;
            try {
                if (hadRetry && !this._applied) this._scheduleRetry();
            } catch (error) {
                this._legacySuspended = true;
                throw error;
            }
            resumed = true;
        };
    }
    /**
     * Для цілей з Boolean = False: одразу ставимо booleanEnabled = false і вимикаємо
     * runOnStart. Тоді будь-який наступний rebuild (initialize, SmartStretch, пробіл)
     * повертає вихідний mesh замість вирізання — навіть якщо mesh ще не готовий.
     */ _lockDisabledTargets() {
        for (const [targetName, values] of Object.entries(this.dataRule.boolean.values)){
            const cutterName = values[this.configurationKey];
            if (cutterName !== false) continue;
            for (const target of SceneEntityHelper.collectByNames(this.entity, [
                targetName
            ])){
                const mb = target.script?.meshBoolean;
                if (!mb) continue;
                mb.booleanEnabled = false;
                mb.runOnStart = false;
            }
        }
    }
    // ================== Visibility ==================
    _applyVisibility() {
        return this._applyTransformConfig(this.configurationKey, this.dataRule.visibility, (entity, value)=>SceneTransformHelper.setVisibleByState(entity, value));
    }
    // ================== Boolean ==================
    async _applyBooleanConfig(key) {
        const jobs = [];
        for (const [targetName, values] of Object.entries(this.dataRule.boolean.values)){
            if (values[key] !== false) return false;
            const targets = SceneEntityHelper.collectByNames(this.entity, [
                targetName
            ]);
            if (!targets.length || targets.some((target)=>!target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh)) {
                LoggerService.warn(this, `[${this.name}] Boolean target is not ready`, {
                    targetName
                });
                return false;
            }
            jobs.push(...targets);
        }
        await Promise.all(jobs.map((target)=>SceneBooleanHelper.setEnabled(target, false, {
                immediate: true
            })));
        return jobs.every((target)=>{
            const mb = target.script.meshBoolean;
            if (!mb._sourceMesh) mb.cacheSourceMesh?.();
            return mb.booleanEnabled === false && !!mb._sourceMesh && SceneEntityHelper.getMeshInstances(target)[0]?.mesh === mb._sourceMesh;
        });
    }
    constructor(){
        super({
            name: 'RuleTypeSideCabinetULH',
            watchAttributes: [],
            priority: 5
        });
        this.configurationKey = 'side';
        this.dataRule = {
            visibility: {
                values: {
                    ULH_Cabinet_SCBackWall: {
                        side: 'Enable'
                    },
                    ULH_Drawer_Framing: {
                        side: 'Disable'
                    },
                    ULH_Drawer_TopFraming: {
                        side: 'Disable'
                    },
                    // Cutter-и SB не потрібні: без вирізання їх ніхто не ховає.
                    ULH_Drawer_SBBoolBox: {
                        side: 'Disable'
                    },
                    ULH_Cabinet_SBBoolBox: {
                        side: 'Disable'
                    }
                }
            },
            boolean: {
                values: {
                    ULH_Drawer_Floor: {
                        side: false
                    },
                    ULH_Drawer_BWall: {
                        side: false
                    },
                    ULH_Cabinet_Walls: {
                        side: false
                    }
                }
            }
        };
        this._applied = false;
        this._booleanInFlight = null;
        this._retryAttempts = 0;
        this._retryHandle = null;
    }
}
/** Скільки разів повторювати Boolean, якщо шаблон/mesh ще не готовий. */ _define_property(RuleTypeSideCabinetULH, "MAX_RETRY_ATTEMPTS", 20);
/** Кадрів між повторами. */ _define_property(RuleTypeSideCabinetULH, "RETRY_DELAY_FRAMES", 5);

export { RuleTypeSideCabinetULH };
