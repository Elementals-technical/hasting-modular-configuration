import { BoundingBox } from '../../../../../playcanvas-stable.min.mjs';
import { LoggerService } from '../../services/logger/logger-service.mjs';
import { SceneEntityHelper } from '../../helpers/scene-entity-helper.mjs';
import { ProductRegistry_V2 } from '../product/registry/product-registry-v2.mjs';

/**
 * Агрегатор для обробки міжпродуктових залежностей та складної логіки.
 * Підписується на зміни в композиціях і виконує правила агрегації.
 *
 * Будує shared context один раз перед виконанням handlers,
 * щоб уникнути повторних запитів до стору та entity tree.
 */ class SceneAggregator {
    /**
     * Починає batch mode — всі виклики onProductChanged/onCompositionStructureChanged
     * збираються, але НЕ виконуються до endBatch().
     */ beginBatch() {
        this._batchMode = true;
        this._batchChanges = null;
        this._batchStructure = null;
    }
    /**
     * Завершує batch mode — виконує зібрані зміни один раз з найсвіжішим станом.
     */ async endBatch() {
        this._batchMode = false;
        if (this._batchStructure) {
            const pending = this._batchStructure;
            this._batchStructure = null;
            await this.onCompositionStructureChanged(pending.compositionId, pending.allCompositions, true, pending.acceptedHandlers);
        }
        if (this._batchChanges) {
            const pending = this._batchChanges;
            this._batchChanges = null;
            await this.onProductChanged(pending.compositionId, pending.productId, pending.changes, pending.allCompositions, true, pending.acceptedHandlers);
        }
    }
    /**
     * Чекає, доки поточний цикл handlers і відкладені запити завершаться.
     * Використовується API queue, щоб наступна зовнішня mutation не стартувала
     * поверх ще активних composition rules.
     */ async whenIdle(timeoutMs = 5000) {
        const startedAt = Date.now();
        while(this._isExecuting || this._pendingProductChanged || this._pendingStructureChanged || this._batchChanges || this._batchStructure || this._batchMode){
            if (Date.now() - startedAt > timeoutMs) {
                LoggerService.warn(this, `[SceneAggregator] whenIdle timeout after ${timeoutMs}ms`);
                return false;
            }
            await new Promise((resolve)=>setTimeout(resolve, 0));
        }
        return true;
    }
    /**
     * Реєструє обробник для агрегації даних
     * @param {string} name - Назва обробника
     * @param {object} config
     * @param {string[]} config.watchCompositions - Які композиції відстежувати
     * @param {string[]} config.watchParams - Які параметри відстежувати
     * @param {Function} [config.acceptFn] - Synchronous acceptance before serialized execution
     * @param {Function} config.aggregateFn - Функція агрегації (collections) => result
     * @param {Function} config.applyFn - Функція застосування результату (result, context) => void
     */ registerHandler(name, config) {
        this._handlers.set(name, {
            ...config,
            enabled: true
        });
        LoggerService.log(this, `📋 [SceneAggregator] Registered handler "${name}"`, {
            watchCompositions: config.watchCompositions
        });
    }
    /**
     * Викликається при зміні будь-якого продукту в будь-якій композиції.
     * При множинних викликах (setConfigBatch) — зберігає лише останній
     * і виконує його після завершення поточного, щоб boolean бачив ВСІ зміни.
     */ async onProductChanged(compositionId, productId, changes, allCompositions, alreadyAccepted = false, acceptedHandlers = null) {
        this._assertLegacyWritable(allCompositions, compositionId);
        const relevantHandlers = this._getRelevantHandlers(compositionId);
        if (!alreadyAccepted) {
            acceptedHandlers = this._acceptHandlers(relevantHandlers, {
                compositionId,
                productId,
                changes,
                structureChanged: false
            });
        }
        if (relevantHandlers.length === 0) return;
        // Batch mode: збираємо, не виконуємо
        if (this._batchMode) {
            this._batchChanges = this._coalesceProductChange(this._batchChanges, {
                compositionId,
                productId,
                changes,
                allCompositions,
                acceptedHandlers
            });
            return;
        }
        // Якщо вже виконуємо — зберігаємо останній запит
        if (this._isExecuting) {
            this._pendingProductChanged = this._coalesceProductChange(this._pendingProductChanged, {
                compositionId,
                productId,
                changes,
                allCompositions,
                acceptedHandlers
            });
            return;
        }
        this._isExecuting = true;
        LoggerService.log(this, `🔄 [SceneAggregator] Processing ${relevantHandlers.length} handlers for "${compositionId}"`, {
            productId,
            changes
        });
        try {
            const shared = this._buildSharedContext();
            for (const [name, config] of relevantHandlers){
                await this._executeHandler(name, config, allCompositions, {
                    compositionId,
                    productId,
                    changes,
                    accepted: acceptedHandlers?.get(name),
                    shared
                });
            }
        } finally{
            this._isExecuting = false;
        }
        // Виконуємо pending запити (product + structure)
        await this._processPending();
    }
    /**
     * Викликається при додаванні/видаленні продукту.
     * Аналогічний queue як onProductChanged.
     */ async onCompositionStructureChanged(compositionId, allCompositions, alreadyAccepted = false, acceptedHandlers = null) {
        this._assertLegacyWritable(allCompositions, compositionId);
        const relevantHandlers = this._getRelevantHandlers(compositionId);
        if (!alreadyAccepted) {
            acceptedHandlers = this._acceptHandlers(relevantHandlers, {
                compositionId,
                productId: null,
                changes: null,
                structureChanged: true
            });
        }
        if (relevantHandlers.length === 0) return;
        // Batch mode: збираємо, не виконуємо
        if (this._batchMode) {
            this._batchStructure = {
                compositionId,
                allCompositions,
                acceptedHandlers
            };
            return;
        }
        if (this._isExecuting) {
            this._pendingStructureChanged = {
                compositionId,
                allCompositions,
                acceptedHandlers
            };
            return;
        }
        this._isExecuting = true;
        try {
            const shared = this._buildSharedContext();
            for (const [name, config] of relevantHandlers){
                await this._executeHandler(name, config, allCompositions, {
                    compositionId,
                    structureChanged: true,
                    accepted: acceptedHandlers?.get(name),
                    shared
                });
            }
        } finally{
            this._isExecuting = false;
        }
        // Виконуємо pending запити (structure + product)
        await this._processPending();
    }
    /**
     * Обробляє всі pending запити (cross-type).
     * Гарантує що pending від onProductChanged не загубиться під час
     * onCompositionStructureChanged і навпаки.
     * @private
     */ async _processPending() {
        if (this._pendingStructureChanged) {
            const pending = this._pendingStructureChanged;
            this._pendingStructureChanged = null;
            await this.onCompositionStructureChanged(pending.compositionId, pending.allCompositions, true, pending.acceptedHandlers);
        }
        if (this._pendingProductChanged) {
            const pending = this._pendingProductChanged;
            this._pendingProductChanged = null;
            await this.onProductChanged(pending.compositionId, pending.productId, pending.changes, pending.allCompositions, true, pending.acceptedHandlers);
        }
    }
    /**
     * Synchronous acceptance boundary for handlers that must invalidate stale async work before
     * this aggregator's serialized execution queue reaches their apply phase.
     */ _acceptHandlers(handlers, context) {
        const accepted = new Map();
        for (const [name, config] of handlers){
            if (typeof config.acceptFn !== 'function') continue;
            if (context.changes && config.watchParams && !config.watchParams.some((param)=>param in context.changes)) continue;
            try {
                accepted.set(name, config.acceptFn(context));
            } catch (error) {
                LoggerService.error(this, `❌ [SceneAggregator] Handler "${name}" acceptance failed`, error);
            }
        }
        return accepted;
    }
    /**
     * Preserve every watched key represented by a coalesced source notification and keep the
     * newest acceptance ticket per handler. An unrelated later key must not strand a reservation
     * made by an earlier notification while another handler cycle is active.
     */ _coalesceProductChange(previous, next) {
        if (!previous || previous.compositionId !== next.compositionId) return next;
        const acceptedHandlers = new Map(previous.acceptedHandlers ?? []);
        for (const [name, accepted] of next.acceptedHandlers ?? []){
            acceptedHandlers.set(name, accepted);
        }
        return {
            ...next,
            changes: {
                ...previous.changes ?? {},
                ...next.changes ?? {}
            },
            acceptedHandlers
        };
    }
    /**
     * Будує shared context один раз для всіх handlers в поточному циклі.
     * Entities та AABB обчислюються лише тут, не в кожному правилі окремо.
     *
     * @returns {object} shared context
     * @private
     */ _buildSharedContext() {
        const compositionManager = this.app.compositionManager;
        if (!compositionManager) return {};
        const composition = compositionManager.getActiveComposition();
        if (!composition) return {};
        // Entities по категоріях — один запит замість 12+
        const cabinets = compositionManager.getProductEntitiesByCategory('cabinets');
        const countertops = compositionManager.getProductEntitiesByCategory('countertops');
        const addons = compositionManager.getProductEntitiesByCategory('addons');
        // Всі продукти — один виклик замість 5+
        const allProducts = composition.getAllProducts();
        // Cabinets AABB — один обхід замість 2+ (RuleSidePanels + RuleTowelBars)
        const cabinetsAabb = this._aggregateAabb(cabinets);
        return {
            entities: {
                cabinets,
                countertops,
                addons
            },
            allProducts,
            cabinetsAabb,
            composition
        };
    }
    /**
     * Агрегує AABB для масиву entities
     * @param {Array<pc.Entity>} entities
     * @returns {BoundingBox|null}
     * @private
     */ _aggregateAabb(entities) {
        const totalAABB = new BoundingBox();
        let initialized = false;
        entities.forEach((entity)=>{
            if (!entity.enabled) return;
            const aabb = SceneEntityHelper.traverseAabb(entity, ProductRegistry_V2.instance.getAabbIgnoreNodesByEntity(entity.name));
            if (!aabb) return;
            if (!initialized) {
                totalAABB.copy(aabb);
                initialized = true;
            } else {
                totalAABB.add(aabb);
            }
        });
        return initialized ? totalAABB : null;
    }
    /**
     * Знаходить handlers що відстежують дану композицію
     * @private
     */ _getRelevantHandlers(compositionId) {
        if (this._suspendedCompositions.has(compositionId)) return [];
        return Array.from(this._handlers.entries()).filter(([_, config])=>config.enabled && config.watchCompositions.includes(compositionId));
    }
    /** Stop acceptance and execution for an adopted composition without changing other scenes. */ suspendForComposition(compositionId) {
        if (this._isExecuting || this._batchMode || this._pendingProductChanged || this._pendingStructureChanged || this._batchChanges || this._batchStructure) {
            throw Object.assign(new Error('Legacy aggregation is still active'), {
                code: 'LEGACY_WRITERS_BUSY'
            });
        }
        if (this._suspendedCompositions.has(compositionId)) {
            throw Object.assign(new Error('Legacy aggregation is already suspended'), {
                code: 'LEGACY_HANDOFF_BUSY'
            });
        }
        this._suspendedCompositions.add(compositionId);
        let resumed = false;
        return ()=>{
            if (resumed) return;
            resumed = true;
            this._suspendedCompositions.delete(compositionId);
        };
    }
    /**
     * Виконує конкретний обробник
     */ _assertLegacyWritable(allCompositions, compositionId) {
        this.app?.compositionManager?.assertCompositionMutable?.(compositionId);
        this.app?.compositionManager?.getActiveComposition?.()?.assertMutable?.();
        if (compositionId) allCompositions?.[compositionId]?.assertMutable?.();
    }
    async _executeHandler(name, config, allCompositions, context) {
        this._assertLegacyWritable(allCompositions, context.compositionId);
        for (const id of config.watchCompositions)allCompositions?.[id]?.assertMutable?.();
        try {
            // Фільтруємо композиції для цього обробника
            const watchedCompositions = {};
            config.watchCompositions.forEach((colId)=>{
                if (allCompositions[colId]) {
                    watchedCompositions[colId] = allCompositions[colId];
                }
            });
            // Перевіряємо чи потрібно виконувати (якщо змінені відстежувані параметри)
            if (context.changes && config.watchParams) {
                const hasRelevantChanges = config.watchParams.some((param)=>param in context.changes);
                if (!hasRelevantChanges) return;
            }
            // Виконуємо агрегацію
            const result = config.aggregateFn(watchedCompositions, context);
            // Кешуємо результат
            this._cache.set(name, {
                result,
                timestamp: Date.now()
            });
            // Застосовуємо результат (shared вже є в context)
            if (config.applyFn) {
                await config.applyFn(result, {
                    app: this.app,
                    collections: watchedCompositions,
                    ...context
                });
            }
            LoggerService.log(this, `✅ [SceneAggregator] Handler "${name}" executed`, {
                result
            });
        } catch (error) {
            LoggerService.error(this, `❌ [SceneAggregator] Handler "${name}" failed`, error);
        }
    }
    /**
     * Отримує кешований результат обробника
     */ getCachedResult(handlerName) {
        return this._cache.get(handlerName)?.result;
    }
    /**
     * Вимикає/вмикає обробник
     */ setHandlerEnabled(name, enabled) {
        const handler = this._handlers.get(name);
        if (handler) {
            handler.enabled = enabled;
        }
    }
    /**
     * Примусово виконує всі обробники
     */ async recalculateAll(allCompositions) {
        this._assertLegacyWritable(allCompositions);
        for (const composition of Object.values(allCompositions))composition.assertMutable?.();
        LoggerService.log(this, '🔄 [SceneAggregator] Recalculating all handlers...');
        const shared = this._buildSharedContext();
        for (const [name, config] of this._handlers.entries()){
            if (config.enabled && !config.watchCompositions?.some((id)=>this._suspendedCompositions.has(id))) {
                await this._executeHandler(name, config, allCompositions, {
                    fullRecalc: true,
                    shared
                });
            }
        }
    }
    constructor(app){
        this.app = app;
        // Зареєстровані обробники (handlers) для різних типів змін
        this._handlers = new Map(); // Map<handlerName, HandlerConfig>
        // Кеш агрегованих даних
        this._cache = new Map();
        // Queue: запобігає паралельному виконанню handlers
        this._isExecuting = false;
        this._pendingProductChanged = null;
        this._pendingStructureChanged = null;
        // Batch mode: збирає виклики під час batch, виконує один раз при endBatch
        this._batchMode = false;
        this._batchChanges = null;
        this._batchStructure = null;
        this._suspendedCompositions = new Set();
        LoggerService.log(this, '🔄 [SceneAggregator] Initialized');
    }
}

export { SceneAggregator };
