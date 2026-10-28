import { Script } from '../../../../../playcanvas-stable.min.mjs';
import { CompositionStore } from './composition-store.mjs';
import { SceneAggregator } from './scene-aggregator.mjs';
import { LoggerService } from '../../services/logger/logger-service.mjs';
import { PositionBuilder } from '../../builder/position-builder.mjs';
import { AutoPlacementService } from '../../services/autoPlacement/auto-placement-service.mjs';
import { SnapshotProductAttribute } from '../../services/product/snapshot-product-attribute.mjs';
import { ProductFactory } from '../product/factory/product-factory.mjs';
import { RuleCountertopLayout } from './rules/RuleCountertopLayout.mjs';
import { RuleCountertopBooleanCutouts } from './rules/RuleCountertopBooleanCutouts.mjs';
import { RuleSidePanels } from './rules/RuleSidePanels.mjs';
import { isCountertopCollisionGeometryChange, RuleCountertopCollisionRefresh, scheduleSpatialSettleRelease } from './rules/RuleCountertopCollisionRefresh.mjs';
import { RuleTowelBars } from './rules/RuleTowelBars.mjs';
import { ProductRegistry_V2 } from '../product/registry/product-registry-v2.mjs';
import { AddonManager } from '../addons/addon-manager.mjs';
import { RuleSlinkMaterial } from './rules/RuleChangeBasinStyleMaterial.mjs';
import { RuleHandleStretchForSideShelf } from './rules/RuleHandleStretchForSideShelf.mjs';
import { RuleOpenSideShelfNeighboursUrbanDuplex } from './rules/RuleOpenSideShelfNeighboursUrbanDuplex.mjs';
import { CABINET_LAYOUT_GAP_METERS } from './layout-constants.mjs';
import { SceneEntityHelper } from '../../helpers/scene-entity-helper.mjs';
import { DividerDebugLogger } from '../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';
import { createCountertopCompositionAdapter } from '../countertop/adapters/countertop-composition-adapter.mjs';
import { createTandemCountertopWriter } from '../countertop/tandem/tandem-countertop-writer.mjs';
import { resolveCountertopPositioningProfile, DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID, COUNTERTOP_PLACEMENT } from '../countertop/countertop-support-resolver.mjs';
import { CompositionModules } from './spatial/composition-modules.mjs';
import { CompositionSpatial } from './spatial/composition-spatial.mjs';
import { createCoverCompositionAdapter } from '../countertop/cover/adapters/cover-composition-adapter.mjs';
import { defaultCoverSettingsFor } from '../countertop/countertop-collections.mjs';
import { createCoverProductPort } from '../countertop/cover/adapters/cover-product-port.mjs';
import { createCabinetCoverService } from '../countertop/cover/cover-service.mjs';
import { isCabinetCoverProduct, resolveBasinTopProduct } from '../countertop/countertop-role.mjs';
import { UFBaseboardService } from '../product/services/CabinetUrbanFreestanding/UFBaseboardService.mjs';
import { RuleUFBaseboard } from './rules/RuleUFBaseboard.mjs';
import { LameUndertopService } from '../product/services/CabinetLame/LameUndertopService.mjs';
import { RuleLameUndertop } from './rules/RuleLameUndertop.mjs';
import { LameLegsService } from '../product/services/CabinetLame/LameLegsService.mjs';
import { RuleLameLegs } from './rules/RuleLameLegs.mjs';

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
const cabinetCoverError = (message)=>Object.assign(new Error(message), {
        code: 'CABINET_COVER_DERIVED_READ_ONLY'
    });
const cabinetCoverTeardownError = (compositionId, operation, { result = null, cause = null } = {})=>{
    const error = Object.assign(new Error(`Cabinet cover teardown failed for composition "${compositionId}" during ${operation}`), {
        code: 'CABINET_COVER_TEARDOWN_FAILED',
        compositionId,
        operation,
        diagnostics: [
            ...result?.diagnostics ?? []
        ]
    });
    if (cause) error.cause = cause;
    return error;
};
const coverResetSucceeded = (result)=>result == null || [
        'applied',
        'unchanged'
    ].includes(result.status);
const compositionTeardownInProgress = (compositionId)=>Object.assign(new Error(`Composition "${compositionId}" is being torn down`), {
        code: 'COMPOSITION_TEARDOWN_IN_PROGRESS',
        compositionId
    });
const snapshotData = (snapshot)=>typeof snapshot?.getAll === 'function' ? {
        ...snapshot.getAll()
    } : {
        ...snapshot ?? {}
    };
const restoreSavedPosition = (entity, config, productId)=>{
    const fields = [
        'positionX',
        'positionY',
        'positionZ'
    ];
    const values = fields.map((field)=>config[field]);
    const supplied = values.map((value)=>value !== undefined);
    if (!supplied.some(Boolean)) return;
    if (!supplied.every(Boolean) || values.some((value)=>typeof value !== 'number' || !Number.isFinite(value))) {
        throw new Error(`Invalid saved position for restored product ${productId}`);
    }
    if (typeof entity?.setPosition !== 'function') {
        throw new Error(`Restored product ${productId} cannot apply its saved position`);
    }
    entity.setPosition(values[0], values[1], values[2]);
};
const detachEntity = (entity)=>{
    const parent = entity?.parent ?? null;
    if (!parent) return null;
    if (typeof parent.removeChild === 'function') parent.removeChild(entity);
    else if (Array.isArray(parent.children)) {
        parent.children = parent.children.filter((child)=>child !== entity);
        entity.parent = null;
    }
    return parent;
};
const liveStandardPosition = (entity, snapshot)=>{
    if (!entity || typeof entity.getPosition !== 'function') return null;
    const position = entity.getPosition();
    const offset = snapshotData(snapshot).SpatialOffsetM;
    const offsetX = Number.isFinite(offset?.x) ? offset.x : 0;
    const offsetY = Number.isFinite(offset?.y) ? offset.y : 0;
    const values = [
        position?.x - offsetX,
        position?.y - offsetY,
        position?.z
    ];
    if (!values.every(Number.isFinite)) return null;
    return {
        positionX: values[0],
        positionY: values[1],
        positionZ: values[2]
    };
};
/**
 * Менеджер композицій - керує декількома композиціями продуктів
 * 
 * ТЕРМІНОЛОГІЯ:
 * - Колекція (Collection) = набір продуктів клієнта (каталог)
 * - Композиція (Composition) = products розміщені на сцені зі спільною логікою
 * 
 * Замінює/розширює RootStore для підтримки множинних композицій
 */ class CompositionManager extends Script {
    initialize() {
        if (CompositionManager._instance) {
            return CompositionManager._instance;
        }
        // Всі композиції
        this._compositions = new Map(); // Map<compositionId, CompositionStore>
        // Активна композиція (з якою зараз працюють)
        this._activeCompositionId = null;
        // Агрегатор для міжпродуктової логіки
        this.aggregator = new SceneAggregator(this.app);
        // Addon Manager — управління всіма addon state machines
        this.addonManager = new AddonManager(this.app, this);
        // Shortcuts для прямого доступу
        this.sidePanelAddon = this.addonManager.sidePanel;
        this.towelBarAddon = this.addonManager.towelBar;
        // Backward compatibility for legacy side-panel layout integrations.
        this.sidePanelsService = this.sidePanelAddon;
        // The composition's spatial world (shared by the countertop and the modules) and its
        // re-measure policy while aggregations reshape the composition.
        this.spatial = new CompositionSpatial({
            app: this.app,
            getComposition: ()=>this.getActiveComposition(),
            registry: ProductRegistry_V2.instance,
            onError: (error)=>LoggerService.error(this, '[CompositionManager] spatial', error)
        });
        // CT-07: one countertop runtime binding for the active composition.
        this.countertopCompositionAdapter = createCountertopCompositionAdapter(this.app, this);
        // Tandem tops: clones of a thin basin top on sink bases set apart (countertop/tandem/), laid out and cut by the
        // countertop rules like the basin top.
        this.tandemCountertopWriter = createTandemCountertopWriter();
        this.cabinetCoverProductPort = createCoverProductPort({
            app: this.app,
            getComposition: (compositionId)=>this.getComposition(compositionId)
        });
        this.cabinetCoverService = createCabinetCoverService({
            port: this.cabinetCoverProductPort
        });
        this.cabinetCoverCompositionAdapter = createCoverCompositionAdapter({
            app: this.app,
            getComposition: (compositionId)=>this.getComposition(compositionId),
            getActiveCompositionId: ()=>this._activeCompositionId,
            allowFreeLayout: ()=>this.preserveCabinetPositions,
            defaultSettingsFor: defaultCoverSettingsFor,
            // The cover plan measures the basin top AND the tandem tops: it waits for the geometry of both.
            countertopAdapter: {
                whenGeometrySettled: async ()=>{
                    const result = await this.countertopCompositionAdapter.whenGeometrySettled();
                    await this.tandemCountertopWriter?.whenSettled();
                    return result;
                }
            },
            service: this.cabinetCoverService
        });
        this._spatialSettleRestorers = [];
        this._installSpatialSettleHooks();
        // Free positioning of modules (offset from their packed slot) on the shared spatial world.
        this.modules = new CompositionModules({
            app: this.app,
            compositionManager: this,
            getWorld: ()=>this.spatial.world
        });
        // Реєстрація в app
        this.app.compositionManager = this;
        CompositionManager._instance = this;
        LoggerService.log(this, "🗂️ [CompositionManager] Initialized");
        // Реєстрація UF Baseboard Service
        this.ufBaseboardService = new UFBaseboardService(this.app, this);
        this.lameUndertopService = new LameUndertopService(this.app, this);
        this.lameLegsService = new LameLegsService(this.app, this);
        // Реєстрація стандартних обробників
        this._registerDefaultHandlers();
    }
    static get instance() {
        return CompositionManager._instance;
    }
    // ====== КОМПОЗИЦІЇ ======
    /**
   * Створює нову композицію
   */ createComposition(compositionId, compositionType = "default") {
        if (this._compositions.has(compositionId)) {
            LoggerService.warn(this, `[CompositionManager] Composition "${compositionId}" already exists`);
            return this._compositions.get(compositionId);
        }
        const composition = new CompositionStore(compositionId, compositionType);
        this._compositions.set(compositionId, composition);
        // Якщо це перша композиція - робимо її активною
        if (!this._activeCompositionId) {
            this._activeCompositionId = compositionId;
        }
        LoggerService.log(this, `📂 [CompositionManager] Created composition "${compositionId}" (${compositionType})`);
        return composition;
    }
    /**
   * Отримує композицію
   */ getComposition(compositionId) {
        return this._compositions.get(compositionId);
    }
    /**
   * Отримує активну композицію
   */ getActiveComposition() {
        return this._compositions.get(this._activeCompositionId);
    }
    isCompositionTearingDown(compositionId = this._activeCompositionId) {
        return Boolean(compositionId && this._compositionTeardowns?.has(compositionId));
    }
    assertCompositionMutable(compositionId = this._activeCompositionId) {
        if (this.isCompositionTearingDown(compositionId)) {
            throw compositionTeardownInProgress(compositionId);
        }
        this._compositions?.get(compositionId)?.assertMutable?.();
        return true;
    }
    /**
   * Повертає список productId в активній або вказаній композиції по категорії
   * @param {string} category
   * @param {string} [compositionId]
   * @returns {string[]}
   */ getProductIdsByCategory(category, compositionId = this._activeCompositionId) {
        const composition = this.getComposition(compositionId);
        if (!composition) return [];
        const all = composition.getAllProducts();
        return Object.entries(all).filter(([id, snapshot])=>snapshot && snapshot.category === category).map(([id])=>id);
    }
    /**
   * Повертає список scene entities (pc.Entity) для продуктів певної категорії
   * @param {string} category
   * @param {string} [compositionId]
   * @returns {pc.Entity[]}
   */ getProductEntitiesByCategory(category, compositionId = this._activeCompositionId) {
        const ids = this.getProductIdsByCategory(category, compositionId);
        const entities = ids.map((id)=>this.app.root.findByName(id)).filter((e)=>!!e);
        return entities;
    }
    /**
   * Встановлює активну композицію
   */ setActiveComposition(compositionId) {
        this._compositions?.get(this._activeCompositionId)?.assertMutable?.();
        this._compositions?.get(compositionId)?.assertMutable?.();
        if (!this._compositions.has(compositionId)) {
            LoggerService.error(this, `[CompositionManager] Composition "${compositionId}" not found`);
            return false;
        }
        if (this._compositionTeardowns?.has(compositionId)) {
            LoggerService.warn(this, `[CompositionManager] Composition "${compositionId}" is being torn down`);
            return false;
        }
        this._activeCompositionId = compositionId;
        this.lameLegsService?.activate(compositionId).catch((error)=>{
            LoggerService.error(this, "[LameLegs] Activation failed", error);
        });
        this.lameUndertopService?.activate(compositionId).catch((error)=>{
            LoggerService.error(this, "[LameUndertop] Activation failed", error);
        });
        // Activate UF Baseboard Service
        this.ufBaseboardService?.activate(compositionId).catch((error)=>{
            LoggerService.error(this, '[UFBaseboard] Activation failed', error);
        });
        this.countertopCompositionAdapter?.activateComposition(compositionId);
        const activation = Promise.resolve(this.cabinetCoverCompositionAdapter?.activateComposition(compositionId));
        this._cabinetCoverActivation = activation;
        activation.catch((error)=>{
            LoggerService.error(this, '[CompositionManager] Cabinet cover activation failed', error);
        });
        this.modules?.activateComposition?.(compositionId);
        LoggerService.log(this, `🎯 [CompositionManager] Active composition set to "${compositionId}"`);
        return true;
    }
    /**
   * Видаляє композицію
   */ async removeComposition(compositionId) {
        this.assertCompositionMutable(compositionId);
        const composition = this.getComposition(compositionId);
        if (!composition) return false;
        this._compositionTeardowns ?? (this._compositionTeardowns = new Set());
        if (this._compositionTeardowns.has(compositionId)) {
            throw compositionTeardownInProgress(compositionId);
        }
        this._compositionTeardowns.add(compositionId);
        const productIds = Object.keys(composition.getAllProducts?.() ?? {});
        const wasActive = this._activeCompositionId === compositionId;
        try {
            let resetResult;
            try {
                resetResult = await this.cabinetCoverCompositionAdapter?.resetForComposition(compositionId, 'composition-removed');
            } catch (cause) {
                throw cabinetCoverTeardownError(compositionId, 'remove-composition', {
                    cause
                });
            }
            if (!coverResetSucceeded(resetResult)) {
                throw cabinetCoverTeardownError(compositionId, 'remove-composition', {
                    result: resetResult
                });
            }
            this.countertopCompositionAdapter?.resetForComposition(compositionId, 'composition-removed');
            this.ufBaseboardService?.remove(compositionId);
            this.lameUndertopService?.remove(compositionId);
            this.lameLegsService?.remove(compositionId);
            const deleted = this._compositions.delete(compositionId);
            for (const productId of productIds)this.app?.root?.findByName?.(productId)?.destroy?.();
            if (deleted && wasActive && this._activeCompositionId === compositionId) {
                const firstComposition = this._compositions.keys().next().value ?? null;
                this._activeCompositionId = null;
                if (firstComposition !== null) {
                    this.setActiveComposition(firstComposition);
                    await this._cabinetCoverActivation;
                    await this.cabinetCoverCompositionAdapter?.whenSettled?.();
                }
            }
            await this.modules?.sync?.();
            return deleted;
        } finally{
            this._compositionTeardowns.delete(compositionId);
        }
    }
    /**
   * Отримує всі композиції
   */ getAllCompositions() {
        return Object.fromEntries(this._compositions);
    }
    // ====== ПРОДУКТИ (працюємо з активною композицією) ======
    /**
   * Додає продукт в активну композицію
   */ async addProductToActiveComposition(productId, snapshot) {
        const composition = this.getActiveComposition();
        if (!composition) {
            LoggerService.error(this, "[CompositionManager] No active composition");
            return false;
        }
        this.assertCompositionMutable(composition.compositionId);
        if (isCabinetCoverProduct(snapshot)) {
            throw cabinetCoverError('Cabinet_Cover products are derived and cannot be added directly');
        }
        this._invalidateSpatial('composition-product-adding', null, true);
        try {
            composition.addProduct(productId, snapshot);
            // Автоматичне створення стільниці при додаванні першої тумби
            await this._ensureCountertopExists(composition);
            // Автоматичне створення addons при наявності cabinets
            await this.addonManager.ensureAll(composition);
            // Повідомляємо агрегатор (await гарантує завершення composition rules перед поверненням)
            await this.aggregator.onCompositionStructureChanged(this._activeCompositionId, this.getAllCompositions());
            // Оновлюємо triPlanarMapping для всіх overlay entities
            // (запобігає зникненню оверлеїв при додаванні нових тумб)
            this.refreshAllOverlayMaterials();
            return true;
        } catch (error) {
            await this._abortSpatialSettleAfterFailure();
            throw error;
        }
    }
    /**
   * Перевіряє чи існує стільниця, якщо ні - створює її при наявності хоча б 1 тумби
   * @private
   */ async _ensureCountertopExists(composition) {
        // 1. Виконання правил в правильній послідовності:
        // // Перевіряємо чи вже є стільниця на сцені
        // const existingCountertop = this.app.root.findByName('Top_Solid');
        // if (existingCountertop) return; // Вже є - нічого не робимо
        // Перевіряємо чи вже є стільниця в композиції (через категорію, бо entity має унікальне ім'я)
        const allProducts = composition.getAllProducts();
        const basinResolution = resolveBasinTopProduct(allProducts);
        const hasCountertop = basinResolution.status !== 'missing';
        if (hasCountertop) return; // Вже є - нічого не робимо
        const hasCabinets = Object.values(allProducts).some((product)=>product.category === "cabinets");
        if (!hasCabinets) return;
        // Створюємо стільницю
        try {
            LoggerService.log(this, "🔨 [CompositionManager] Creating Top_Solid countertop...");
            const entity = await new ProductFactory().createProductEntity("Top_Solid");
            if (!entity) {
                LoggerService.error(this, '[CompositionManager] Failed to create entity for "Top_Solid"');
                return;
            }
            this.app.root.addChild(entity);
            // Підготовка конфігурації з категорією
            const productMeta = ProductRegistry_V2.instance.getProductConfig("Top_Solid") || {};
            const cabinets = Object.values(allProducts).filter((p)=>p.category === 'cabinets');
            const firstCabinet = cabinets[0] || {};
            const positioningProfile = resolveCountertopPositioningProfile({
                cabinets,
                getProductConfig: (productType)=>ProductRegistry_V2.instance.getProductConfig(productType)
            });
            const config = {
                Depth: firstCabinet.Depth || 50.5,
                Height: firstCabinet.Height || 56,
                CountertopLengthM: productMeta.defaultConfig?.CountertopLengthM ?? null,
                CountertopColor: firstCabinet.CountertopColor,
                Thickness: firstCabinet.Thickness ?? productMeta.defaultConfig?.Thickness ?? 0.5,
                sinkType: firstCabinet.sinkType,
                entityName: "Top_Solid",
                productType: "Top_Solid",
                category: productMeta.category || "countertops",
                CountertopPositioning: positioningProfile.strategy,
                CountertopRole: 'basinTop',
                CountertopPlacement: COUNTERTOP_PLACEMENT.SUPPORTED,
                SupportGroupId: DEFAULT_COUNTERTOP_SUPPORT_GROUP_ID
            };
            // Додаємо в композицію (без layout, бо це фіксована сутність)
            composition.addProduct(entity.name, config);
            // Виконуємо правила продукту
            await this._executeProductRules(entity, config);
            LoggerService.log(this, "✅ [CompositionManager] Top_Solid countertop created");
        } catch (error) {
            LoggerService.error(this, "[CompositionManager] Failed to create countertop:", error);
        }
    }
    /**
   * Оновлює продукт в композиції
   */ updateProductInComposition(compositionId, productId, changes) {
        const composition = this.getComposition(compositionId);
        if (!composition) return false;
        this.assertCompositionMutable(compositionId);
        const currentSnapshot = composition.getProduct(productId);
        if (!currentSnapshot) return false;
        if (isCabinetCoverProduct(currentSnapshot)) {
            throw cabinetCoverError('Cabinet_Cover products cannot be configured directly');
        }
        this._invalidateSpatial('composition-product-config-changing', changes, true);
        // Створюємо новий snapshot з змінами
        const nextSnapshot = currentSnapshot.createNext ? currentSnapshot.createNext(changes) : {
            ...currentSnapshot,
            ...changes
        };
        composition.addProduct(productId, nextSnapshot);
        // Повідомляємо агрегатор про зміни
        this.aggregator.onProductChanged(compositionId, productId, changes, this.getAllCompositions());
        return true;
    }
    /**
   * Видаляє продукт з композиції
   */ removeProductFromComposition(compositionId, productId) {
        const composition = this.getComposition(compositionId);
        if (!composition) return false;
        this.assertCompositionMutable(compositionId);
        if (!composition.getProduct(productId)) return false;
        if (isCabinetCoverProduct(composition.getProduct(productId))) {
            throw cabinetCoverError('Cabinet_Cover products cannot be deleted directly');
        }
        this._invalidateSpatial('composition-product-removing', null, true);
        const deleted = composition.removeProduct(productId);
        if (deleted) {
            // Перевіряємо чи залишились тумби, якщо ні - видаляємо стільницю
            this._removeCountertopIfNoCabinets(composition);
            this.aggregator.onCompositionStructureChanged(compositionId, this.getAllCompositions());
        }
        return deleted;
    }
    /**
   * Видаляє стільницю якщо в композиції більше немає тумб
   * @private
   */ _removeCountertopIfNoCabinets(composition) {
        const listCabinets = this.getProductEntitiesByCategory("cabinets", composition.compositionId);
        const hasCabinets = listCabinets.length > 0;
        // Якщо тумби ще є — нічого не видаляємо
        if (hasCabinets) return;
        this.countertopCompositionAdapter?.resetForComposition(composition.compositionId, 'last-cabinet-removed');
        // Шукаємо стільницю через категорію (бо entity має унікальне ім'я)
        const basinResolution = resolveBasinTopProduct(composition.getAllProducts());
        const countertopId = basinResolution.status === 'found' ? basinResolution.productId : null;
        const countertop = countertopId ? this.app.root.findByName(countertopId) : null;
        if (countertopId && countertop) {
            composition.removeProduct(countertopId);
            countertop.destroy();
            LoggerService.log(this, "🗑️ [CompositionManager] Removed Top_Solid countertop (no cabinets left)");
        }
        // Видаляємо всі addons (тільки коли кабінетів більше немає)
        this.addonManager.removeAll(composition);
    }
    // ====== OVERLAY MATERIALS REFRESH ======
    /**
   * Оновлює triPlanarMapping матеріали для всіх overlay entities у всіх тумбах.
   * Викликається після зміни структури композиції для запобігання зникненню оверлеїв.
   */ refreshAllOverlayMaterials() {
        const cabinetEntities = this.getProductEntitiesByCategory('cabinets');
        let refreshedCount = 0;
        cabinetEntities.forEach((cabinetEntity)=>{
            // Рекурсивно збираємо всі overlay entities
            const overlays = this._collectOverlayEntities(cabinetEntity);
            overlays.forEach((overlayEntity)=>{
                // Refresh triPlanarMapping
                if (overlayEntity.script?.triPlanarMapping && typeof overlayEntity.script.triPlanarMapping.refreshMaterials === 'function') {
                    overlayEntity.script.triPlanarMapping.refreshMaterials();
                    refreshedCount++;
                }
                // Refresh smartStretch
                if (overlayEntity.script?.smartStretch && typeof overlayEntity.script.smartStretch.refreshMaterials === 'function') {
                    overlayEntity.script.smartStretch.refreshMaterials();
                }
            });
        });
        if (refreshedCount > 0) {
            LoggerService.log(this, `🔄 [CompositionManager] Refreshed triPlanarMapping for ${refreshedCount} overlay entities`);
        }
    }
    /**
   * Рекурсивно збирає всі overlay entities (імена містять '_Overlay')
   * @param {Entity} rootEntity - Коренева сутність для пошуку
   * @returns {Entity[]} - Масив overlay entities
   * @private
   */ _collectOverlayEntities(rootEntity) {
        const overlays = [];
        const traverse = (entity)=>{
            if (entity.name.includes('_Overlay')) {
                overlays.push(entity);
            }
            entity.children.forEach((child)=>traverse(child));
        };
        traverse(rootEntity);
        return overlays;
    }
    // ====== АГРЕГАЦІЯ ======
    /**
   * Реєструє обробник агрегації
   */ registerAggregationHandler(name, config) {
        this.aggregator.registerHandler(name, config);
    }
    _invalidateSpatial(reason, changes = null, holdUntilAggregation = false) {
        if (changes && !isCountertopCollisionGeometryChange(changes)) return null;
        const spatial = this.spatial;
        if (holdUntilAggregation && !spatial?.settling) {
            return spatial?.beginSettle(reason) || null;
        }
        return spatial?.invalidate(reason) || null;
    }
    _installSpatialSettleHooks() {
        const aggregator = this.aggregator;
        if (!aggregator || this._spatialSettleRestorers.length > 0) return;
        const install = (methodName, relevant, reason)=>{
            const original = aggregator[methodName];
            if (typeof original !== 'function') return;
            const wrapped = async (...args)=>{
                if (!relevant(...args)) return original.apply(aggregator, args);
                this.assertCompositionMutable(typeof args[0] === 'string' ? args[0] : this._activeCompositionId);
                const spatial = this.spatial;
                const alreadyQueued = Boolean(aggregator._batchMode || aggregator._isExecuting);
                if (alreadyQueued) {
                    spatial?.invalidate(reason);
                    try {
                        return await original.apply(aggregator, args);
                    } finally{
                        scheduleSpatialSettleRelease({
                            aggregator,
                            spatial
                        });
                    }
                }
                const inheritedSettle = Boolean(spatial?.settling);
                if (!inheritedSettle) spatial?.beginSettle(reason);
                try {
                    return await original.apply(aggregator, args);
                } finally{
                    await spatial?.endSettle();
                }
            };
            aggregator[methodName] = wrapped;
            this._spatialSettleRestorers.push(()=>{
                if (aggregator[methodName] === wrapped) aggregator[methodName] = original;
            });
        };
        install('onProductChanged', (_compositionId, _productId, changes)=>isCountertopCollisionGeometryChange(changes), 'composition-product-geometry-changing');
        install('onCompositionStructureChanged', ()=>true, 'composition-structure-changing');
        install('recalculateAll', ()=>true, 'composition-preset-changing');
    }
    _removeSpatialSettleHooks() {
        const restorers = this._spatialSettleRestorers || [];
        while(restorers.length > 0)restorers.pop()();
    }
    async _abortSpatialSettleAfterFailure() {
        const spatial = this.spatial;
        if (!spatial?.settling) return;
        spatial.abortSettle();
    }
    /**
   * Отримує агреговані метрики всіх композицій
   */ getGlobalMetrics() {
        const metrics = {};
        this._compositions.forEach((composition, id)=>{
            metrics[id] = composition.getMetrics();
        });
        return metrics;
    }
    // ====== СТАНДАРТНІ ОБРОБНИКИ ======
    _registerDefaultHandlers() {
        // Set Lame support planes before countertop layout reads them.
        const lameUndertopRule = new RuleLameUndertop(this.lameUndertopService);
        this.registerAggregationHandler(lameUndertopRule.name, lameUndertopRule.toHandlerConfig());
        // Fit the UD open side shelves (height, side, neighbour handles) before countertop layout measures them:
        // the aggregator runs handlers in registration order, and the shelf rule only moves meshes, so a countertop
        // measured earlier would keep the shelf's template height and hang in the air.
        const udOpenSideShelfNeighboursRule = new RuleOpenSideShelfNeighboursUrbanDuplex();
        this.registerAggregationHandler(udOpenSideShelfNeighboursRule.name, udOpenSideShelfNeighboursRule.toHandlerConfig());
        // Створюємо інстанси composition rules
        const countertopLayoutRule = new RuleCountertopLayout();
        const countertopBooleanRule = new RuleCountertopBooleanCutouts();
        this.sidePanelsRule = new RuleSidePanels();
        this.towelBarsRule = new RuleTowelBars();
        const slinkMaterialRule = new RuleSlinkMaterial();
        // // Реєструємо правила через toHandlerConfig()
        this.registerAggregationHandler(countertopLayoutRule.name, countertopLayoutRule.toHandlerConfig());
        this.registerAggregationHandler(countertopBooleanRule.name, countertopBooleanRule.toHandlerConfig());
        this.registerAggregationHandler(this.sidePanelsRule.name, this.sidePanelsRule.toHandlerConfig());
        this.registerAggregationHandler(this.towelBarsRule.name, this.towelBarsRule.toHandlerConfig());
        this.registerAggregationHandler(slinkMaterialRule.name, slinkMaterialRule.toHandlerConfig());
        const handleStretchRule = new RuleHandleStretchForSideShelf();
        this.registerAggregationHandler(handleStretchRule.name, handleStretchRule.toHandlerConfig());
        // UF Baseboard Rule
        const ufBaseboardRule = new RuleUFBaseboard(this.ufBaseboardService);
        this.registerAggregationHandler(ufBaseboardRule.name, ufBaseboardRule.toHandlerConfig());
        const lameLegsRule = new RuleLameLegs(this.lameLegsService);
        this.registerAggregationHandler(lameLegsRule.name, lameLegsRule.toHandlerConfig());
        // Must remain the final project rule: it observes geometry only after
        // SidePanels, SmartStretch and Boolean-producing handlers have settled.
        const countertopCollisionRefreshRule = new RuleCountertopCollisionRefresh();
        this.registerAggregationHandler('CabinetCoverReconcile', this.cabinetCoverCompositionAdapter.toAggregationHandler());
        this.registerAggregationHandler(countertopCollisionRefreshRule.name, countertopCollisionRefreshRule.toHandlerConfig());
    // LoggerService.log(
    //     this,
    //     '🔧 [CompositionManager] Registered composition rules',
    //     {
    //         // rules: [countertopWidthRule.name, countertopBooleanRule.name]
    //     }
    // );
    }
    // ====== LAYOUT MANAGEMENT (NEW) ======
    /**
   * Розраховує позицію для нового продукту
   * @param {Entity} entity - Entity для позиціювання
   * @param {string|null} prevEntityId - ID попереднього entity або null
   * @param {string} side - 'left' або 'right'
   * @returns {Vec3} - Розрахована позиція
   */ calculatePosition(entity, prevEntityId, side) {
        this.assertCompositionMutable();
        const composition = this.getActiveComposition();
        if (!composition) {
            LoggerService.error(this, "[CompositionManager] No active composition for layout");
            return {
                x: 0,
                y: 0,
                z: 0
            };
        }
        const entities = this.getProductEntitiesByCategory("cabinets");
        const entitiesForAabbIgnore = entity ? [
            ...entities,
            entity
        ] : entities;
        const positionBuilder = PositionBuilder.create(entities, composition.getOrderProductIds()).setAxis("x").setGap(CABINET_LAYOUT_GAP_METERS).setIgnoreNodes(ProductRegistry_V2.instance.collectAabbIgnoreNodes(entitiesForAabbIgnore));
        positionBuilder.addEntity(entity, prevEntityId, side);
        const positions = positionBuilder.build();
        // Оновлюємо orderIndex для всіх
        positions.forEach(({ entity: e, index })=>{
            composition.setOrderProductId(e.name, index);
        });
        const targetPosition = positions.find((p)=>p.entity === entity);
        return targetPosition ? targetPosition.position : {
            x: 0,
            y: 0,
            z: 0
        };
    }
    calculatePositions(entity, prevEntityId, side) {
        this.assertCompositionMutable();
        const composition = this.getActiveComposition();
        if (!composition) {
            LoggerService.error(this, "[CompositionManager] No active composition for layout");
            return {
                x: 0,
                y: 0,
                z: 0
            };
        }
        const entities = this.getProductEntitiesByCategory('cabinets');
        if (this.preserveCabinetPositions) {
            return this._calculatePreservedCabinetPosition(entity, entities, composition, prevEntityId, side);
        }
        const entitiesForAabbIgnore = entity ? [
            ...entities,
            entity
        ] : entities;
        const positionBuilder = PositionBuilder.create(entities, composition.getOrderProductIds()).setAxis("x").setGap(CABINET_LAYOUT_GAP_METERS).setIgnoreNodes(ProductRegistry_V2.instance.collectAabbIgnoreNodes(entitiesForAabbIgnore));
        positionBuilder.addEntity(entity, prevEntityId, side);
        const positions = positionBuilder.build();
        const results = [];
        positions.forEach(({ entity: e, index, isChanged, position })=>{
            composition.setOrderProductId(e.name, index);
            if (isChanged) {
                results.push({
                    entity: e,
                    position: position
                });
            }
        });
        return results;
    }
    /**
   * Place one new cabinet without changing any existing cabinet pose.
   * Logical order still follows left/right insertion so downstream consumers
   * do not have to infer order from mutable world coordinates.
   */ _calculatePreservedCabinetPosition(entity, entities, composition, prevEntityId, side) {
        // Modular collections: the free-layout policy inserts into the anchor's row (HR-RW-03). A null
        // result (no policy / not its composition / unmeasurable) keeps the behaviour below.
        const planned = this.freeLayoutPolicy?.placeNew?.(entity, entities, composition, prevEntityId, side);
        if (planned) return planned;
        const normalizedSide = side === 'left' ? 'left' : 'right';
        const order = composition.getOrderProductIds();
        const orderedEntities = entities.map((item, arrayIndex)=>({
                entity: item,
                arrayIndex,
                orderIndex: Number.isFinite(order[item.name]) ? order[item.name] : Number.POSITIVE_INFINITY
            })).sort((a, b)=>a.orderIndex - b.orderIndex || a.arrayIndex - b.arrayIndex).map((item)=>item.entity);
        if (orderedEntities.length === 0) {
            const position = entity.getPosition().clone();
            position.x = 0;
            position.y = 0;
            position.z = 0;
            composition.setOrderProductId(entity.name, 0);
            return [
                {
                    entity,
                    position,
                    index: 0,
                    isChanged: true
                }
            ];
        }
        const placement = new AutoPlacementService().setAxis('x').setGap(CABINET_LAYOUT_GAP_METERS).setIgnoreNodes(ProductRegistry_V2.instance.collectAabbIgnoreNodes([
            ...entities,
            entity
        ]));
        const boundsOnX = (item)=>{
            const bounds = placement._getEntityAABB(item, placement._ignoreNodes);
            return {
                min: bounds.center.x - bounds.halfExtents.x,
                max: bounds.center.x + bounds.halfExtents.x
            };
        };
        let anchor = prevEntityId ? orderedEntities.find((item)=>item.name === prevEntityId) ?? null : null;
        if (!anchor) {
            anchor = orderedEntities.reduce((extreme, candidate)=>{
                if (!extreme) return candidate;
                const candidateBounds = boundsOnX(candidate);
                const extremeBounds = boundsOnX(extreme);
                return normalizedSide === 'left' ? candidateBounds.min < extremeBounds.min ? candidate : extreme : candidateBounds.max > extremeBounds.max ? candidate : extreme;
            }, null);
        }
        // AutoPlacementService supplies the standard root alignment and measured
        // widths. Correct X by the measured world edges as cabinet pivots need not
        // be centered inside their visible geometry.
        const position = placement.getPosition(anchor, entity, normalizedSide, CABINET_LAYOUT_GAP_METERS);
        const anchorBounds = boundsOnX(anchor);
        const newBounds = boundsOnX(entity);
        const newRootX = entity.getPosition().x;
        position.x = normalizedSide === 'left' ? anchorBounds.min - CABINET_LAYOUT_GAP_METERS - (newBounds.max - newRootX) : anchorBounds.max + CABINET_LAYOUT_GAP_METERS - (newBounds.min - newRootX);
        const anchorIndex = orderedEntities.indexOf(anchor);
        const insertIndex = normalizedSide === 'left' ? anchorIndex : anchorIndex + 1;
        orderedEntities.splice(insertIndex, 0, entity);
        orderedEntities.forEach((item, index)=>composition.setOrderProductId(item.name, index));
        return [
            {
                entity,
                position,
                index: insertIndex,
                isChanged: true
            }
        ];
    }
    /**
   * Перераховує layout після змін (видалення, swap)
   * @param {{ reason?: string, productIds?: string[] }|null} [change] - used only by the free-layout policy
   * @param {{ notifyRules?: boolean }} [options] - notifyRules=false when the caller itself reruns
   *   the composition rules right after (SceneManager.removeProduct → onCompositionStructureChanged)
   */ recalculateLayout(change = null, { notifyRules = true } = {}) {
        this.assertCompositionMutable();
        if (this.preserveCabinetPositions) {
            const composition = this.getActiveComposition();
            if (!composition) {
                LoggerService.error(this, "[CompositionManager] No active composition for recalculation");
                return;
            }
            // Modular collections: re-lay only the affected rows (HR-RW-03/HR-RW-04); null = renumber only (below).
            const reflowed = this.freeLayoutPolicy?.reflow?.(composition, change?.reason ?? 'recalculate', change);
            if (reflowed) {
                if (reflowed.movedIds?.length) this._invalidateSpatial('composition-order-changing');
                this.modules?.sync();
                if (notifyRules) this._notifyRegroupedRules(composition, reflowed);
                return;
            }
            const order = composition.getOrderProductIds();
            this.getProductEntitiesByCategory('cabinets').map((entity, arrayIndex)=>({
                    entity,
                    arrayIndex,
                    orderIndex: Number.isFinite(order[entity.name]) ? order[entity.name] : Number.POSITIVE_INFINITY
                })).sort((a, b)=>a.orderIndex - b.orderIndex || a.arrayIndex - b.arrayIndex).forEach(({ entity }, index)=>composition.setOrderProductId(entity.name, index));
            this.modules?.sync();
            return;
        }
        const result = this.modules ? this.modules.withStandardPositions(()=>this._recalculatePackedLayout()) : this._recalculatePackedLayout();
        this.modules?.sync();
        return result;
    }
    /**
   * A reflow that rewrote SupportGroupId (e.g. a deleted cabinet split its row) bypassed the rule
   * pipeline (raw composition.addProduct). Rerun the countertop/cover rules once, the same way the
   * policy's observe() does. Fire-and-forget: recalculateLayout stays synchronous.
   * @private
   */ _notifyRegroupedRules(composition, reflowed) {
        const last = reflowed?.changedGroupIds?.at?.(-1);
        if (!last) return;
        let pending;
        try {
            pending = this.aggregator?.onProductChanged?.(composition.compositionId, last, {
                SupportGroupId: reflowed.groups?.get?.(last)
            }, this.getAllCompositions());
        } catch (error) {
            pending = Promise.reject(error);
        }
        Promise.resolve(pending).catch((error)=>LoggerService.error(this, '[CompositionManager] Regroup rule notification failed', error));
    }
    /** Pack the cabinet slots along X (modules are on their standard positions here). */ _recalculatePackedLayout() {
        const composition = this.getActiveComposition();
        if (!composition) {
            LoggerService.error(this, "[CompositionManager] No active composition for recalculation");
            return;
        }
        this._invalidateSpatial('composition-order-changing');
        const entities = this.getProductEntitiesByCategory("cabinets");
        const traceId = DividerDebugLogger.nextTraceId('cabinet-layout-recalc');
        const ignoreNodes = ProductRegistry_V2.instance.collectAabbIgnoreNodes(entities);
        DividerDebugLogger.log('CabinetLayout.recalculateLayout.start', 'Recalculate layout started', {
            traceId,
            cabinetCount: entities.length,
            gap: CABINET_LAYOUT_GAP_METERS,
            orderProductIds: composition.getOrderProductIds(),
            ignoredNodePatterns: ignoreNodes,
            entitiesBeforeBuild: this._summarizeCabinetLayoutEntities(entities)
        });
        const positionBuilder = PositionBuilder.create(entities, composition.getOrderProductIds()).setAxis("x").setGap(CABINET_LAYOUT_GAP_METERS).setIgnoreNodes(ignoreNodes);
        const positions = positionBuilder.build();
        DividerDebugLogger.log('CabinetLayout.recalculateLayout.positionsBuilt', 'PositionBuilder returned layout positions', {
            traceId,
            positions: positions.map(({ entity, position, index, isChanged })=>({
                    entity: entity?.name,
                    index,
                    isChanged,
                    position: this._summarizeVec3(position)
                }))
        });
        // Оновлюємо позиції та orderIndex
        positions.forEach(({ entity, position, index })=>{
            entity.setPosition(position.x, position.y, position.z);
            composition.setOrderProductId(entity.name, index);
        });
        DividerDebugLogger.log('CabinetLayout.recalculateLayout.done', 'Recalculate layout completed', {
            traceId,
            orderProductIds: composition.getOrderProductIds(),
            entitiesAfterBuild: this._summarizeCabinetLayoutEntities(entities)
        });
        LoggerService.log(this, `📐 [CompositionManager] Layout recalculated for ${positions.length} products`);
    }
    /**
   * Додає продукт з автоматичним позиціюванням
   * @param {Entity} entity - Entity продукту
   * @param {Object} config - Конфігурація продукту
   * @param {Object} layoutOptions - { prevEntityId, side }
   */ async addProductWithLayout(entity, config, layoutOptions = {}) {
        this.assertCompositionMutable();
        const { prevEntityId = null, side = "right" } = layoutOptions;
        this._invalidateSpatial('composition-product-adding', null, true);
        try {
            // 1. Виконання правил в правильній послідовності:
            // 1.1. Product Rules (специфічні для типу продукту)
            await this._executeProductRules(entity, config);
            // 1.2. Global Rules (спільні для всіх продуктів) - виконуються автоматично в ProductController
            // 2. Розрахувати позицію
            // const position = this.calculatePosition(entity, prevEntityId, side);
            // entity.setPosition(position.x, position.y, position.z);
            const layOut = ()=>{
                const positions = this.calculatePositions(entity, prevEntityId, side);
                positions.forEach(({ entity, position })=>{
                    entity.setPosition(position.x, position.y, position.z);
                });
                return positions;
            };
            const positions = this.preserveCabinetPositions ? layOut() : this.modules ? this.modules.withStandardPositions(layOut) : layOut();
            // layoutConfig: only a free-layout policy supplies it (e.g. the row's SupportGroupId).
            const { position, config: layoutConfig } = positions.find((p)=>p.entity === entity);
            // 3. Додати в композицію
            // Preserve the immutable registry identity before entityName becomes the runtime instance ID.
            // Older callers may only provide the registry lookup key in entityName, so resolve that key
            // through the registry instead of treating the asset/entity name itself as a product type.
            const productType = config.productType || ProductRegistry_V2.instance.getProductConfig(config.entityName)?.productType || null;
            const enrichedConfig = {
                ...config,
                ...layoutConfig ?? {},
                productType,
                positionX: position.x,
                positionY: position.y,
                positionZ: position.z,
                entityName: entity.name
            };
            // this.addProductToActiveComposition(entity.name, enrichedConfig);
            // 4. Додати в композицію
            await this.addProductToActiveComposition(entity.name, enrichedConfig);
            this.modules?.sync();
            // 5. Aggregation Handlers (композиційні правила) - виконаються автоматично в addProductToActiveComposition
            LoggerService.log(this, `➕ [CompositionManager] Added product "${entity.name}" at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            return entity.name;
        } catch (error) {
            await this._abortSpatialSettleAfterFailure();
            throw error;
        }
    }
    /**
   * Виконує Product Rules для продукту
   * @private
   */ async _executeProductRules(entity, config) {
        // Знаходимо ProductController на entity
        const productController = entity.script?.get("productController");
        if (!productController || !productController.ruleExecutor) {
            LoggerService.warn(this, `[CompositionManager] ProductController not found on "${entity.name}". Rules not executed.`);
            return;
        }
        // Створюємо snapshot для immutability, diffing та версіонування
        const currentSnapshot = new SnapshotProductAttribute(config);
        const previousSnapshot = new SnapshotProductAttribute({});
        DividerDebugLogger.log('CabinetLayout.ProductRules.start', 'Product rules start before possible scale rebuild', {
            productId: entity?.name,
            config: this._summarizeLayoutConfig(config),
            entity: this._summarizeLayoutEntity(entity)
        });
        // Виконуємо правила напряму через RuleExecutor
        await productController.ruleExecutor.executeRules({
            changes: config,
            currentState: currentSnapshot,
            previousState: previousSnapshot
        });
        DividerDebugLogger.log('CabinetLayout.ProductRules.done', 'Product rules done after scale rebuild', {
            productId: entity?.name,
            config: this._summarizeLayoutConfig(config),
            entity: this._summarizeLayoutEntity(entity)
        });
        LoggerService.log(this, `✅ [CompositionManager] Product rules executed for "${entity.name}"`);
    }
    /**
   * Виконує Product Rules з розділенням changes (що змінилось) та currentState (повний стан).
   * На відміну від _executeProductRules, rules отримують точний diff — спрацьовують
   * тільки ті що підписані на реально змінені атрибути.
   *
   * @param {pc.Entity} entity
   * @param {Object} changes - тільки змінені поля (наприклад { CabinetColor: '...' })
   * @param {Object} fullConfig - повний merged config
   */ async _executeProductRulesWithChanges(entity, changes, fullConfig) {
        const productController = entity.script?.get("productController");
        if (!productController || !productController.ruleExecutor) return;
        const currentSnapshot = new SnapshotProductAttribute(fullConfig);
        const previousSnapshot = new SnapshotProductAttribute({});
        DividerDebugLogger.log('CabinetLayout.ProductRulesWithChanges.start', 'Product rules with changes start', {
            productId: entity?.name,
            changedKeys: Object.keys(changes || {}),
            changes: this._summarizeLayoutConfig(changes),
            fullConfig: this._summarizeLayoutConfig(fullConfig),
            entity: this._summarizeLayoutEntity(entity)
        });
        await productController.ruleExecutor.executeRules({
            changes,
            currentState: currentSnapshot,
            previousState: previousSnapshot
        });
        DividerDebugLogger.log('CabinetLayout.ProductRulesWithChanges.done', 'Product rules with changes done', {
            productId: entity?.name,
            changedKeys: Object.keys(changes || {}),
            fullConfig: this._summarizeLayoutConfig(fullConfig),
            entity: this._summarizeLayoutEntity(entity)
        });
        LoggerService.log(this, `✅ [CompositionManager] Product rules executed for "${entity.name}" (changes: ${Object.keys(changes).join(', ')})`);
    }
    /**
   * Оновлює конфігурацію продукту та перераховує layout
   * @param {string} productId - ID продукту
   * @param {Object} config - Нова конфігурація
   * @returns {boolean} - Успішність оновлення
   */ async updateProductConfig(productId, config) {
        this.assertCompositionMutable();
        const composition = this.getActiveComposition();
        if (!composition) {
            LoggerService.error(this, "[CompositionManager] No active composition");
            return false;
        }
        // Отримуємо поточну конфігурацію
        const currentConfig = composition.getProduct(productId);
        if (!currentConfig) {
            LoggerService.error(this, `[CompositionManager] Product "${productId}" not found`);
            return false;
        }
        this._invalidateSpatial('composition-product-config-changing', config, true);
        try {
            // Об'єднуємо конфігурації
            const updatedConfig = {
                ...currentConfig,
                ...config
            };
            const sizeChanged = config.Width !== undefined || config.Height !== undefined || config.Depth !== undefined;
            const traceId = DividerDebugLogger.nextTraceId('cabinet-layout-update');
            const entityBeforeUpdate = this.app.root.findByName(productId);
            DividerDebugLogger.log('CabinetLayout.updateProductConfig.start', 'Product config update started', {
                traceId,
                productId,
                changedKeys: Object.keys(config || {}),
                sizeChanged,
                changes: this._summarizeLayoutConfig(config),
                currentConfig: this._summarizeLayoutConfig(currentConfig),
                updatedConfig: this._summarizeLayoutConfig(updatedConfig),
                entityBeforeRules: this._summarizeLayoutEntity(entityBeforeUpdate)
            });
            // Оновлюємо в store
            composition.addProduct(productId, updatedConfig);
            // Виконуємо правила продукту
            const entity = this.app.root.findByName(productId);
            if (entity) {
                DividerDebugLogger.log('CabinetLayout.updateProductConfig.beforeRules', 'About to execute product rules before layout recalculation', {
                    traceId,
                    productId,
                    entity: this._summarizeLayoutEntity(entity)
                });
                await this._executeProductRules(entity, updatedConfig);
                DividerDebugLogger.log('CabinetLayout.updateProductConfig.afterRules', 'Product rules finished before layout recalculation', {
                    traceId,
                    productId,
                    entity: this._summarizeLayoutEntity(entity)
                });
            }
            // Перераховуємо layout якщо змінились розміри
            if (sizeChanged) {
                DividerDebugLogger.log('CabinetLayout.updateProductConfig.beforeRecalculateLayout', 'About to recalculate layout after size change', {
                    traceId,
                    productId,
                    entities: this._summarizeCabinetLayoutEntities()
                });
                this.recalculateLayout();
                DividerDebugLogger.log('CabinetLayout.updateProductConfig.afterRecalculateLayout', 'Layout recalculated after size change', {
                    traceId,
                    productId,
                    entities: this._summarizeCabinetLayoutEntities()
                });
                LoggerService.log(this, `📐 [CompositionManager] Layout recalculated after size change`);
            }
            if (isCountertopCollisionGeometryChange(config)) {
                await this.aggregator.onProductChanged(this._activeCompositionId, productId, config, this.getAllCompositions());
            }
            // Оновлюємо dimensions після зміни розмірів
            if (sizeChanged) {
                this.app.dimensionSystem?.refresh();
            }
            LoggerService.log(this, `✅ [CompositionManager] Product "${productId}" updated`);
            DividerDebugLogger.log('CabinetLayout.updateProductConfig.done', 'Product config update completed', {
                traceId,
                productId,
                sizeChanged,
                entity: this._summarizeLayoutEntity(this.app.root.findByName(productId))
            });
            return true;
        } catch (error) {
            await this._abortSpatialSettleAfterFailure();
            throw error;
        }
    }
    /**
   * Масове оновлення конфігурації продуктів
   * @param {Object} options - Опції фільтрації
   * @param {string[]} [options.productIds] - Список ID продуктів
   * @param {string} [options.productType] - Тип продукту
   * @param {Object} config - Нова конфігурація
   * @returns {string[]} - Список оновлених ID
   */ async updateProductConfigBatch(options, config) {
        this.assertCompositionMutable();
        const composition = this.getActiveComposition();
        if (!composition) {
            LoggerService.error(this, "[CompositionManager] No active composition");
            return [];
        }
        const allProducts = composition.getProductEntitiesByCategory("cabinets");
        let productIds = options.productIds || Object.keys(allProducts);
        const traceId = DividerDebugLogger.nextTraceId('cabinet-layout-batch');
        const sizeChanged = config.Width !== undefined || config.Height !== undefined || config.Depth !== undefined;
        DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.start', 'Batch product config update started', {
            traceId,
            options,
            changedKeys: Object.keys(config || {}),
            sizeChanged,
            changes: this._summarizeLayoutConfig(config),
            productIdsBeforeFilter: productIds,
            entitiesBeforeRules: this._summarizeCabinetLayoutEntities()
        });
        // Фільтр за типом продукту
        if (options.productType) {
            productIds = productIds.filter((id)=>id.includes(options.productType));
        }
        if (productIds.length > 0) {
            this._invalidateSpatial('composition-product-config-batch-changing', config, true);
        }
        try {
            DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.targetProducts', 'Batch target products resolved', {
                traceId,
                productIds
            });
            const updatedIds = [];
            // Оновлюємо кожен продукт
            for (const productId of productIds){
                const currentConfig = allProducts[productId];
                if (!currentConfig) continue;
                const updatedConfig = {
                    ...currentConfig,
                    ...config
                };
                composition.addProduct(productId, updatedConfig);
                // Виконуємо правила
                const entity = this.app.root.findByName(productId);
                if (entity) {
                    DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.beforeRules', 'About to execute product rules for batch item', {
                        traceId,
                        productId,
                        updatedConfig: this._summarizeLayoutConfig(updatedConfig),
                        entity: this._summarizeLayoutEntity(entity)
                    });
                    await this._executeProductRules(entity, updatedConfig);
                    DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.afterRules', 'Product rules finished for batch item', {
                        traceId,
                        productId,
                        entity: this._summarizeLayoutEntity(entity)
                    });
                }
                updatedIds.push(productId);
            }
            // Перераховуємо layout якщо змінились розміри
            if (sizeChanged && updatedIds.length > 0) {
                DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.beforeRecalculateLayout', 'About to recalculate layout after batch size change', {
                    traceId,
                    updatedIds,
                    entities: this._summarizeCabinetLayoutEntities()
                });
                this.recalculateLayout();
                DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.afterRecalculateLayout', 'Layout recalculated after batch size change', {
                    traceId,
                    updatedIds,
                    entities: this._summarizeCabinetLayoutEntities()
                });
                this.app.dimensionSystem?.refresh();
                LoggerService.log(this, `📐 [CompositionManager] Layout recalculated after batch update`);
            }
            if (updatedIds.length > 0 && isCountertopCollisionGeometryChange(config)) {
                await this.aggregator.onProductChanged(this._activeCompositionId, updatedIds[updatedIds.length - 1], config, this.getAllCompositions());
            }
            LoggerService.log(this, `✅ [CompositionManager] Batch updated ${updatedIds.length} products`);
            DividerDebugLogger.log('CabinetLayout.updateProductConfigBatch.done', 'Batch product config update completed', {
                traceId,
                updatedIds,
                sizeChanged,
                entities: this._summarizeCabinetLayoutEntities()
            });
            return updatedIds;
        } catch (error) {
            await this._abortSpatialSettleAfterFailure();
            throw error;
        }
    }
    /**
   * Видаляє продукт з автоматичним перерахунком layout
   * @param {string} productId - ID продукту
   */ removeProductWithLayout(productId) {
        const removed = this.removeProductFromComposition(this._activeCompositionId, productId);
        if (removed) {
            this.recalculateLayout();
            LoggerService.log(this, `➖ [CompositionManager] Removed product "${productId}" and recalculated layout`);
        }
        return removed;
    }
    /**
   * Очищає всі продукти з активної композиції
   */ async clearComposition(compositionId = this._activeCompositionId) {
        this.assertCompositionMutable(compositionId);
        const composition = this.getComposition(compositionId);
        if (!composition) return;
        this._compositionTeardowns ?? (this._compositionTeardowns = new Set());
        if (this._compositionTeardowns.has(compositionId)) {
            throw compositionTeardownInProgress(compositionId);
        }
        this._compositionTeardowns.add(compositionId);
        const productIds = Object.keys(composition.getAllProducts());
        try {
            let resetResult;
            try {
                resetResult = await this.cabinetCoverCompositionAdapter?.resetForComposition(compositionId, 'composition-cleared');
            } catch (cause) {
                throw cabinetCoverTeardownError(compositionId, 'clear-composition', {
                    cause
                });
            }
            if (!coverResetSucceeded(resetResult)) {
                throw cabinetCoverTeardownError(compositionId, 'clear-composition', {
                    result: resetResult
                });
            }
            this.countertopCompositionAdapter?.resetForComposition(compositionId, 'composition-cleared');
            this.ufBaseboardService?.remove(compositionId);
            this.lameUndertopService?.remove(compositionId);
            this.lameLegsService?.remove(compositionId);
            for (const productId of productIds){
                composition.removeProduct(productId);
                this.app?.root?.findByName?.(productId)?.destroy?.();
            }
            await this.modules?.sync?.();
            LoggerService.log(this, `🗑️ [CompositionManager] Cleared ${productIds.length} products from composition`);
        } finally{
            this._compositionTeardowns.delete(compositionId);
        }
    }
    /**
   * Swap позиції двох продуктів
   * @param {string} productIdA - ID першого продукту
   * @param {string} productIdB - ID другого продукту
   */ swapProducts(productIdA, productIdB) {
        const composition = this.getActiveComposition();
        if (!composition) return false;
        this.assertCompositionMutable(composition.compositionId);
        if (isCabinetCoverProduct(composition.getProduct(productIdA)) || isCabinetCoverProduct(composition.getProduct(productIdB))) {
            throw cabinetCoverError('Cabinet_Cover products cannot be reordered directly');
        }
        const orderIds = composition.getOrderProductIds();
        const indexA = orderIds[productIdA];
        const indexB = orderIds[productIdB];
        if (indexA === undefined || indexB === undefined) {
            LoggerService.error(this, `[CompositionManager] Cannot swap: products not found`);
            return false;
        }
        this._invalidateSpatial('composition-order-changing', null, true);
        // Swap indices
        composition.setOrderProductId(productIdA, indexB);
        composition.setOrderProductId(productIdB, indexA);
        // Recalculate layout (the swapped pair matters only to a free-layout policy's rows)
        this.recalculateLayout({
            reason: 'swap',
            productIds: [
                productIdA,
                productIdB
            ]
        });
        // Повідомляємо агрегатор
        this.aggregator.onCompositionStructureChanged(this._activeCompositionId, this.getAllCompositions());
        LoggerService.log(this, `🔄 [CompositionManager] Swapped products "${productIdA}" <-> "${productIdB}"`);
        return true;
    }
    // ====== ЗБЕРЕЖЕННЯ/ЗАВАНТАЖЕННЯ ======
    /**
   * Експортує всі композиції
   */ exportAllCompositions() {
        const data = {
            activeCompositionId: this._activeCompositionId,
            compositions: {}
        };
        this._compositions.forEach((composition, id)=>{
            const serialized = composition.serialize();
            for (const [productId, snapshot] of Object.entries(serialized.products)){
                const standardPosition = liveStandardPosition(this.app?.root?.findByName?.(productId), snapshot);
                if (!standardPosition) continue;
                serialized.products[productId] = {
                    ...snapshotData(snapshot),
                    ...standardPosition
                };
            }
            data.compositions[id] = serialized;
        });
        return data;
    }
    /**
   * Імпортує композиції
   */ async importCompositions(data, { productFactory = null, replaceCompositionId = null } = {}) {
        for (const composition of this._compositions?.values() ?? [])composition.assertMutable?.();
        if (this._compositionTeardowns?.size) {
            throw compositionTeardownInProgress(this._compositionTeardowns.values().next().value);
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new TypeError('Composition restore data must be an object');
        }
        if (data.compositions != null && (typeof data.compositions !== 'object' || Array.isArray(data.compositions))) {
            throw new TypeError('Composition restore compositions must be an object');
        }
        const scoped = replaceCompositionId !== null;
        if (scoped && (typeof replaceCompositionId !== 'string' || !replaceCompositionId.trim() || Object.keys(data.compositions ?? {}).length !== 1 || !data.compositions[replaceCompositionId])) {
            throw new TypeError('Scoped restore requires exactly its target composition');
        }
        const stagedCompositions = new Map();
        const stagedProducts = [];
        const stagedProductIds = new Set();
        for (const [id, compData] of Object.entries(data.compositions || {})){
            if (!compData || typeof compData !== 'object' || Array.isArray(compData)) {
                throw new TypeError(`Composition restore entry ${id} must be an object`);
            }
            if (compData?.compositionId != null && compData.compositionId !== id) {
                throw new Error(`Composition restore key/id mismatch for ${id}`);
            }
            const composition = CompositionStore.deserialize({
                ...compData,
                compositionId: id
            });
            stagedCompositions.set(id, composition);
            for (const [productId, snapshot] of Object.entries(composition.getAllProducts())){
                if (isCabinetCoverProduct(snapshot)) continue;
                if (stagedProductIds.has(productId)) {
                    throw new Error(`Duplicate restored productId ${productId}`);
                }
                stagedProductIds.add(productId);
                const config = snapshotData(snapshot);
                const productType = config.productType || ProductRegistry_V2.instance.detectProductType(productId);
                if (!productType) throw new Error(`Cannot resolve productType for restored product ${productId}`);
                if (!productFactory && !ProductRegistry_V2.instance.getProductConfig(productType)) {
                    throw new Error(`Cannot reconstruct unregistered productType ${productType}`);
                }
                stagedProducts.push({
                    productId,
                    config,
                    productType
                });
            }
        }
        const factory = productFactory ?? new ProductFactory();
        if (!factory || typeof factory.createProductEntity !== 'function') {
            throw new TypeError('Composition restore requires a ProductFactory-like createProductEntity()');
        }
        if ('app' in factory) factory.app = this.app;
        const previousCompositions = this._compositions;
        const previousActiveId = this._activeCompositionId;
        const previousRoots = [];
        for (const composition of previousCompositions.values()){
            if (scoped && composition.compositionId !== replaceCompositionId) {
                for (const productId of Object.keys(composition.getAllProducts())){
                    if (stagedProductIds.has(productId)) throw new Error(`Restored productId belongs to another composition: ${productId}`);
                }
                continue;
            }
            for (const [productId, snapshot] of Object.entries(composition.getAllProducts())){
                if (isCabinetCoverProduct(snapshot)) continue;
                const entity = this.app.root.findByName(productId);
                if (entity && !previousRoots.some((record)=>record.entity === entity)) {
                    previousRoots.push({
                        entity,
                        parent: entity.parent ?? this.app.root,
                        standardPosition: liveStandardPosition(entity, snapshot)
                    });
                }
            }
        }
        const resetResult = await this.cabinetCoverCompositionAdapter?.resetRuntime?.('compositions-imported');
        if (resetResult?.status === 'error') {
            throw Object.assign(new Error('Cabinet cover runtime could not be reset before restore'), {
                code: 'CABINET_COVER_RESTORE_RESET_FAILED',
                result: resetResult
            });
        }
        this.countertopCompositionAdapter?.reset('compositions-imported');
        this.ufBaseboardService?.reset();
        this.lameUndertopService?.reset();
        this.lameLegsService?.reset();
        const created = [];
        let modulesActivationStarted = false;
        try {
            for (const { productId, productType, config } of stagedProducts){
                const entity = await factory.createProductEntity(productType, config);
                if (!entity || typeof entity.destroy !== 'function') {
                    throw new Error(`ProductFactory did not reconstruct ${productId}`);
                }
                entity.name = productId;
                created.push({
                    entity,
                    config
                });
                restoreSavedPosition(entity, config, productId);
            }
            for (const { entity } of previousRoots)detachEntity(entity);
            this._compositions = scoped ? new Map([
                ...previousCompositions,
                ...stagedCompositions
            ]) : new Map(stagedCompositions);
            const requestedActive = data.activeCompositionId;
            this._activeCompositionId = this._compositions.has(requestedActive) ? requestedActive : this._compositions.keys().next().value ?? null;
            for (const { entity } of created)this.app.root.addChild(entity);
            for (const { entity, config } of created)await this._executeProductRules(entity, config);
            this.addonManager?.rehydrateAll(this.getActiveComposition());
            this.countertopCompositionAdapter?.activateComposition(this._activeCompositionId);
            if (typeof this.modules?.activateComposition === 'function') {
                modulesActivationStarted = true;
                await this.modules.activateComposition(this._activeCompositionId);
            } else if (typeof this.modules?.sync === 'function') {
                modulesActivationStarted = true;
                await this.modules.sync();
            }
            await this.aggregator.recalculateAll(this.getAllCompositions());
            const countertopResult = await this.countertopCompositionAdapter?.whenSettled?.();
            if (scoped && [
                'error',
                'invalid',
                'unsupported',
                'cancelled'
            ].includes(countertopResult?.status)) {
                throw Object.assign(new Error('Countertop could not be restored'), {
                    code: 'COUNTERTOP_RESTORE_FAILED',
                    result: countertopResult
                });
            }
            const coverResult = await this.cabinetCoverCompositionAdapter?.whenSettled?.();
            if (scoped && [
                'error',
                'invalid',
                'unsupported',
                'cancelled'
            ].includes(coverResult?.status)) {
                throw Object.assign(new Error('Cabinet covers could not be restored'), {
                    code: 'CABINET_COVER_RESTORE_FAILED',
                    result: coverResult
                });
            }
            for (const { entity } of previousRoots){
                try {
                    entity?.destroy?.();
                } catch (error) {
                    LoggerService.warn(this, '[CompositionManager] Failed to destroy detached pre-restore root', error);
                }
            }
            LoggerService.log(this, `📥 [CompositionManager] Restored ${this._compositions.size} compositions and ${created.length} primary entities`);
            const incompleteCoverStatuses = new Set([
                'error',
                'invalid',
                'unsupported',
                'cancelled'
            ]);
            return {
                status: incompleteCoverStatuses.has(coverResult?.status) ? coverResult.status : 'restored',
                activeCompositionId: this._activeCompositionId,
                compositionCount: this._compositions.size,
                productCount: created.length,
                cover: coverResult ?? null
            };
        } catch (error) {
            let rollbackError = null;
            try {
                this.ufBaseboardService?.reset();
                this.lameUndertopService?.reset();
                this.lameLegsService?.reset();
                await this.cabinetCoverCompositionAdapter?.resetRuntime?.('composition-restore-failed');
                for (const { entity } of created){
                    detachEntity(entity);
                    entity?.destroy?.();
                }
                this._compositions = previousCompositions;
                this._activeCompositionId = previousActiveId;
                for (const { entity, parent, standardPosition } of previousRoots){
                    if (!entity?.destroyed && !entity?.parent) (parent ?? this.app.root).addChild(entity);
                    if (modulesActivationStarted && standardPosition && typeof entity?.setPosition === 'function') {
                        entity.setPosition(standardPosition.positionX, standardPosition.positionY, standardPosition.positionZ);
                    }
                }
                this.countertopCompositionAdapter?.activateComposition(previousActiveId);
                if (modulesActivationStarted) {
                    if (typeof this.modules?.activateComposition === 'function') {
                        await this.modules.activateComposition(previousActiveId);
                    } else if (typeof this.modules?.sync === 'function') {
                        await this.modules.sync();
                    }
                }
                this.addonManager?.rehydrateAll(this.getActiveComposition());
                await this.aggregator?.recalculateAll?.(this.getAllCompositions());
                await this.cabinetCoverCompositionAdapter?.whenSettled?.();
            } catch (cause) {
                rollbackError = cause;
            }
            if (rollbackError) error.rollbackError = rollbackError;
            throw error;
        }
    }
    notifyCabinetCoverSourceChanged(compositionId, productId, changes) {
        if (!compositionId || !productId) return Promise.resolve(null);
        if (this._compositionTeardowns?.has(compositionId)) return Promise.resolve(null);
        return this.aggregator.onProductChanged(compositionId, productId, changes, this.getAllCompositions());
    }
    onDestroy() {
        this._removeSpatialSettleHooks();
        this.lameUndertopService?.destroy();
        this.lameLegsService?.destroy();
        this.lameUndertopService = null;
        this.lameLegsService = null;
        this.ufBaseboardService?.destroy();
        this.ufBaseboardService = null;
        const modules = this.modules;
        const cabinetCover = this.cabinetCoverCompositionAdapter;
        const countertop = this.countertopCompositionAdapter;
        const spatial = this.spatial;
        this.modules = null;
        this.cabinetCoverCompositionAdapter = null;
        this.cabinetCoverService = null;
        this.cabinetCoverProductPort = null;
        this.countertopCompositionAdapter = null;
        this.tandemCountertopWriter?.destroy();
        this.tandemCountertopWriter = null;
        this.spatial = null;
        if (this.app?.compositionManager === this) {
            this.app.compositionManager = null;
        }
        if (CompositionManager._instance === this) {
            CompositionManager._instance = null;
        }
        Promise.resolve().then(async ()=>{
            await modules?.destroy?.();
            await cabinetCover?.destroy?.();
            countertop?.destroy?.();
            await spatial?.destroy?.();
        }).catch((error)=>{
            LoggerService.error(this, '[CompositionManager] spatial teardown failed', error);
        });
    }
    // ====== SCENE ADDONS (SidePanels) ======
    /**
   * Встановлює тип SidePanel по стороні
   * @param {string} type - 'None' | 'UpperG' | 'CenterG' | 'DoubleG' | 'NoG'
   * @param {string} side - 'left' | 'right' | 'both'
   * @example
   * // Встановити панель зліва
   * await compositionManager.setSidePanelType('UpperG', 'left');
   *
   * // Встановити обидві панелі одночасно
   * await compositionManager.setSidePanelType('UpperG', 'both');
   *
   * // Видалити праву панель
   * await compositionManager.setSidePanelType('None', 'right');
   */ async setSidePanelType(type, side = 'both') {
        this.assertCompositionMutable();
        this._invalidateSpatial('side-panel-variant-changing', null, true);
        try {
            return await this.sidePanelAddon.setType(type, side);
        } finally{
            await this.spatial?.endSettle();
        }
    }
    /**
   * Встановлює тип TowelBar
   * @param {string} type - 'None' | 'TowelBar40_R'
   * @param {string} side - 'left' | 'right' | 'both'
   */ async setTowelBarType(type, side = 'both') {
        this.assertCompositionMutable();
        return await this.towelBarAddon.setType(type, side);
    }
    /**
   * Встановлює колір/матеріал TowelBar глобально
   * @param {string} materialName - Назва матеріалу
   */ async setTowelBarColor(materialName) {
        this.assertCompositionMutable();
        return await this.towelBarAddon.setColor(materialName);
    }
    /**
   * Отримує інформацію про крайні шафи (ліва та права)
   * @returns {object} Об'єкт з ID крайніх шаф { leftCabinetId, rightCabinetId }
   * @example
   * const { leftCabinetId, rightCabinetId } = compositionManager.getEdgeCabinets();
   * console.log('Ліва крайня шафа:', leftCabinetId);
   * console.log('Права крайня шафа:', rightCabinetId);
   */ getEdgeCabinets() {
        const composition = this.getActiveComposition();
        if (!composition) return {
            leftCabinetId: null,
            rightCabinetId: null
        };
        const allProducts = composition.getAllProducts();
        const cabinetProducts = Object.entries(allProducts).filter(([id, p])=>p.category === 'cabinets');
        if (cabinetProducts.length === 0) {
            return {
                leftCabinetId: null,
                rightCabinetId: null
            };
        }
        // Визначаємо позицію шаф за orderIndex
        const orderIds = composition.getOrderProductIds();
        const cabinetIndices = cabinetProducts.map(([id, p])=>({
                id,
                index: orderIds[id]
            })).sort((a, b)=>a.index - b.index);
        return {
            leftCabinetId: cabinetIndices[0].id,
            rightCabinetId: cabinetIndices[cabinetIndices.length - 1].id
        };
    }
    _summarizeLayoutConfig(config = {}) {
        if (!config || typeof config !== 'object') return config;
        return {
            productId: config.productId,
            productType: config.productType,
            category: config.category,
            Width: config.Width,
            Height: config.Height,
            Depth: config.Depth,
            Drawers: config.Drawers,
            topDrawerType: config.topDrawerType,
            positionX: DividerDebugLogger._round(config.positionX),
            positionY: DividerDebugLogger._round(config.positionY),
            positionZ: DividerDebugLogger._round(config.positionZ)
        };
    }
    _summarizeCabinetLayoutEntities(entities = null) {
        const list = entities || this.getProductEntitiesByCategory("cabinets");
        return list.map((entity)=>this._summarizeLayoutEntity(entity));
    }
    _summarizeLayoutEntity(entity) {
        if (!entity) return null;
        const ignoreNodes = ProductRegistry_V2.instance.getAabbIgnoreNodesByEntity(entity.name);
        let ignoredAabb = null;
        let rawAabb = null;
        try {
            ignoredAabb = SceneEntityHelper.traverseAabb(entity, ignoreNodes);
            rawAabb = SceneEntityHelper.traverseAabb(entity, []);
        } catch (error) {
            DividerDebugLogger.warn('CabinetLayout.summarizeEntity', 'Failed to summarize cabinet entity AABB', {
                entityName: entity?.name,
                error
            });
        }
        return {
            name: entity.name,
            enabled: Boolean(entity.enabled),
            position: this._summarizeVec3(entity.getPosition?.()),
            localPosition: this._summarizeVec3(entity.getLocalPosition?.()),
            localScale: this._summarizeVec3(entity.getLocalScale?.()),
            ignoredNodePatterns: ignoreNodes,
            ignoredAabb: this._summarizeAabb(ignoredAabb),
            rawAabb: this._summarizeAabb(rawAabb)
        };
    }
    _summarizeAabb(aabb) {
        if (!aabb) return null;
        const size = aabb.halfExtents?.clone?.().mulScalar?.(2);
        return {
            center: this._summarizeVec3(aabb.center),
            halfExtents: this._summarizeVec3(aabb.halfExtents),
            size: this._summarizeVec3(size)
        };
    }
    _summarizeVec3(vec) {
        if (!vec) return null;
        return {
            x: DividerDebugLogger._round(vec.x),
            y: DividerDebugLogger._round(vec.y),
            z: DividerDebugLogger._round(vec.z)
        };
    }
    constructor(...args){
        super(...args), // Dev-only opt-in: keep every existing cabinet exactly where it is and place
        // only the newly added cabinet against live scene geometry.
        _define_property(this, "preserveCabinetPositions", false), // Installed by the modular runtime while a collection owns the composition (preserve branch only):
        // { placeNew, reflow } of domain/cabinet-placement/adapters/cabinet-rows-layout.mjs. null = none.
        _define_property(this, "freeLayoutPolicy", null);
    }
}
_define_property(CompositionManager, "scriptName", "compositionManager");
_define_property(CompositionManager, "_instance", null);

export { CompositionManager };
