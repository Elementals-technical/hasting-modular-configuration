import { BaseProductRule } from '../base-product-rule.mjs';
import { LoggerService } from '../../../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../../../helpers/scene-entity-helper.mjs';
import { SceneTransformHelper } from '../../../../helpers/scene-transform-helper.mjs';
import { SceneBooleanHelper } from '../../../../helpers/scene-boolean-helper.mjs';
import { OperationType } from '../../../../../mesh-boolean/core/MeshBooleanOperation.mjs';

/**
 * Спільна логіка правил "SB - SC switch" для Urban Low Height.
 *
 * Дочірні класи задають лише таблицю `ruleData`:
 *   visibility: { EntityName: 'Enable' | 'Disable' }
 *   boolean:    { TargetName: 'CutterName' }  → Boolean = True + cutter
 *               { TargetName: false }         → Boolean = False
 *
 * Visibility застосовується при кожному виконанні (ідемпотентно).
 * Boolean налаштовується, доки не буде підтверджений (`_booleanApplied`).
 * Далі перебудову при зміні розмірів робить SmartStretch.
 */
export class ULHCabinetTypeRuleBase extends BaseProductRule {
    constructor(config) {
        super({ watchAttributes: [], ...config });
        this.ruleData = { visibility: {}, boolean: {} };
        this._booleanApplied = false;
        this._booleanInFlight = null;
        this._retryAttempts = 0;
        this._retryHandle = null;
    }

    /** Скільки разів повторювати Boolean, якщо шаблон/mesh ще не готовий. */
    static MAX_RETRY_ATTEMPTS = 20;
    /** Кадрів між повторами. */
    static RETRY_DELAY_FRAMES = 5;

    async execute() {
        // Стан "вимкнено" фіксуємо одразу — до відкладеного runOnStart-вирізання
        // самого meshBoolean (через 6 кадрів після initialize).
        this._lockDisabledTargets();
        this._applyVisibility();
        if (this._booleanApplied) return;
        await this._runBoolean();
    }

    async _runBoolean() {
        // Не запускаємо паралельно: execute і retry можуть збігтися.
        if (this._booleanInFlight) return this._booleanInFlight;

        this._booleanInFlight = (async () => {
            try {
                this._booleanApplied = await this._applyBoolean();
            } catch (error) {
                LoggerService.error(this, `[${this.name}] Boolean failed`, error);
                this._booleanApplied = false;
                if (this.context?.executionMode === 'isolated') throw error;
            } finally {
                // SceneBooleanHelper hides cutters; restore the explicit visibility table even on failure.
                this._applyVisibility();
            }

            LoggerService.log(this, `✅ [${this.name}] Boolean ${this._booleanApplied ? 'applied' : 'pending'}`, {
                attempt: this._retryAttempts
            });

            if (!this._booleanApplied) {
                if (this.context?.executionMode === 'isolated') {
                    throw Object.assign(new Error('Isolated product Boolean is not ready'), {code:'CONFIGURATION_BOOLEAN_PENDING'});
                }
                this._scheduleRetry();
            }
        })();

        try {
            await this._booleanInFlight;
        } finally {
            this._booleanInFlight = null;
        }
    }

    /**
     * Правило виконується лише на зміни атрибутів. Якщо на першому запуску mesh ще не
     * завантажений, без повтору Boolean так і лишився б не застосованим.
     */
    _scheduleRetry() {
        if (this._legacySuspended) return;
        // An isolated transaction owns and awaits all work; it cannot leave an app update retry behind.
        if (this.context?.executionMode === 'isolated') return;
        const app = this.app;
        if (!app || this._retryHandle) return;
        if (this._retryAttempts >= ULHCabinetTypeRuleBase.MAX_RETRY_ATTEMPTS) {
            LoggerService.warn(this, `[${this.name}] Boolean not applied after retries`, {
                productId: this.productId, attempts: this._retryAttempts
            });
            return;
        }

        let frames = ULHCabinetTypeRuleBase.RETRY_DELAY_FRAMES;
        const onUpdate = () => {
            if (--frames > 0) return;
            app.off('update', onUpdate);
            this._retryHandle = null;
            // Продукт видалено або правило вже спрацювало.
            if (!this.entity?.parent || this._booleanApplied) return;
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
        if (this._booleanInFlight) throw Object.assign(new Error('ULH Boolean is still running'), {code:'LEGACY_WRITERS_BUSY'});
        const hadRetry = Boolean(this._retryHandle);
        if (hadRetry) this.app?.off('update', this._retryHandle);
        this._retryHandle = null;
        this._legacySuspended = true;
        let resumed = false;
        return () => {
            if (resumed) return;
            this._legacySuspended = false;
            try {
                if (hadRetry && !this._booleanApplied) this._scheduleRetry();
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
     */
    _lockDisabledTargets() {
        for (const [targetName, cutterName] of Object.entries(this.ruleData.boolean)) {
            if (cutterName !== false) continue;
            for (const target of SceneEntityHelper.collectByNames(this.entity, [targetName])) {
                const mb = target.script?.meshBoolean;
                if (!mb) continue;
                mb.booleanEnabled = false;
                mb.runOnStart = false;
            }
        }
    }

    // ================== Visibility ==================

    _applyVisibility() {
        const cfg = this.ruleData.visibility;
        const names = Object.keys(cfg);
        if (names.length === 0) return;

        const entities = SceneEntityHelper.collectByNames(this.entity, names);
        const found = new Set(entities.map(e => e.name));
        names.filter(n => !found.has(n)).forEach(n =>
            LoggerService.warn(this, `[${this.name}] Visibility entity not found`, {
                productId: this.productId, entityName: n
            }));

        for (const entity of entities) {
            SceneTransformHelper.setVisibleByState(entity, cfg[entity.name]);
        }
    }

    // ================== Boolean ==================

    async _applyBoolean() {
        const root = this.entity;
        const jobs = [];
        // A detached drag preview cannot cut: CSG skips cutters under a disabled root. Its cuts belong
        // to the committed product (Apply rebuilds it); the preview only checks geometry and hides cutters.
        const deferCuts = this.context?.booleanCuts === 'deferred';
        const deferredCutters = [];

        for (const [targetName, cutterName] of Object.entries(this.ruleData.boolean)) {
            const targets = SceneEntityHelper.collectByNames(root, [targetName]);
            if (targets.length === 0) {
                LoggerService.warn(this, `[${this.name}] Boolean target not found`, { targetName });
                return false;
            }

            for (const target of targets) {
                if (deferCuts && cutterName !== false) {
                    const cutter = this._resolveCutter(target, cutterName, root);
                    if (!SceneEntityHelper.getMeshInstances(target)[0]?.mesh ||
                        !cutter || !SceneEntityHelper.getMeshInstances(cutter)[0]?.mesh) {
                        LoggerService.warn(this, `[${this.name}] Deferred cut geometry is not ready`, { targetName, cutterName });
                        return false;
                    }
                    deferredCutters.push(cutter);
                    continue;
                }

                // Не позначаємо як застосоване, поки шаблон не готовий — буде повтор (_scheduleRetry).
                if (!target.script?.meshBoolean || !SceneEntityHelper.getMeshInstances(target)[0]?.mesh) {
                    LoggerService.warn(this, `[${this.name}] Boolean is not ready`, { targetName });
                    return false;
                }

                if (cutterName === false) {
                    jobs.push({ target, cutter: null });
                    continue;
                }

                const cutter = this._resolveCutter(target, cutterName, root);
                if (!cutter || !SceneEntityHelper.getMeshInstances(cutter)[0]?.mesh) {
                    LoggerService.warn(this, `[${this.name}] Cutter is not ready`, { targetName, cutterName });
                    return false;
                }
                jobs.push({ target, cutter });
            }
        }

        for (const cutter of deferredCutters) cutter.enabled = false;

        await Promise.all(jobs.map(({ target, cutter }) => cutter
            ? SceneBooleanHelper.configure(target, {
                enabled: true,
                cutters: [cutter],
                operation: OperationType.SUBTRACT
            }, { debounceMs: 0, delayFrames: 2 })
            : SceneBooleanHelper.setEnabled(target, false, { immediate: true })));

        return jobs.every(({ target, cutter }) => {
            const mb = target.script?.meshBoolean;
            const mesh = SceneEntityHelper.getMeshInstances(target)[0]?.mesh;
            if (mb && !mb._sourceMesh) mb.cacheSourceMesh?.();
            if (!mb?._sourceMesh) return false;
            if (!cutter) return mb.booleanEnabled === false && mesh === mb._sourceMesh;
            return mb.booleanEnabled === true && !!mesh && mesh !== mb._sourceMesh &&
                (!cutter.parent || cutter.parent.enabled);
        });
    }

    /**
     * Cutter шукається в цьому клоні продукту (не в шаблоні), починаючи з найближчого
     * предка target — щоб при кількох шухлядах кожна різалась своїм cutter-ом.
     */
    _resolveCutter(target, cutterName, root) {
        let node = target.parent;
        while (node) {
            const found = SceneEntityHelper.collectByNames(node, [cutterName]).filter(c => c !== target);
            if (found.length > 0) {
                if (found.length > 1) {
                    LoggerService.warn(this, `[${this.name}] Several cutters found, using the first`, {
                        targetName: target.name, cutterName, count: found.length
                    });
                }
                return found[0];
            }
            if (node === root) break;
            node = node.parent;
        }
        return null;
    }
}
