import { Script } from '../../../../../../playcanvas-stable.min.mjs';
import { LoggerService } from '../../../services/logger/logger-service.mjs';
import { AnchorCalculator } from '../../../services/anchorCalculator/anchor-calculator.mjs';
import { ProductFactory } from '../../product/factory/product-factory.mjs';
import { PlusButtonManager } from '../../../services/anchorCalculator/plus-button-manager.mjs';
import { CompositionManager } from '../../composition/composition-manager.mjs';
import { ProductRegistry_V2 } from '../../product/registry/product-registry-v2.mjs';
import { ARExportService } from '../../../services/ar-export/ar-export-service.mjs';
import '../../../services/ar-export/scene-collector.mjs';
import { DrawerViewService } from '../../../services/drawer-view/drawer-view-service.mjs';
import { DrawerOverlaySystem } from '../../../services/OverlaySystem/drawer-overlay-system.mjs';
import { DividerSlotOverlaySystem } from '../../../services/OverlaySystem/divider-slot-overlay-system.mjs';
import { DividerFacade } from '../../../services/drawer-divider/DividerFacade.mjs';
import { DividerDebugLogger } from '../../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';
import { DrawerAnimationService } from '../../../services/drawer-animation/drawer-animation-service.mjs';
import { DimensionSystem } from '../../../services/dimension/LineDimension.mjs';
import { isCabinetCoverProduct } from '../../countertop/countertop-role.mjs';
import { rowEndPlusAnchors } from '../../cabinet-placement/row-plus-anchors.mjs';
import { planColumnPlusButtons } from '../../cabinet-placement/columns/column-plus-anchors.mjs';
import { measureEntityBoundsM } from '../../spatial-manipulation/playcanvas/scene-measure.mjs';
import { measureFloorColliderBox, FLOOR_COLLIDER_ID } from '../room/room-offset.mjs';
import { assertUFInsert, assertUFSwap, applyUFPlusRule } from '../../cabinet-placement/adapters/uf-row-rules.mjs';

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
const derivedCoverError = ()=>Object.assign(new Error('Cabinet_Cover products are derived and cannot be manipulated directly'), {
        code: 'CABINET_COVER_DERIVED_READ_ONLY'
    });
/**
 * The {@link https://api.playcanvas.com/classes/Engine.Script.html | Script} class is
 * the base class for all PlayCanvas scripts. Learn more about writing scripts in the
 * {@link https://developer.playcanvas.com/user-manual/scripting/ | scripting guide}.
 */ class SceneManager extends Script {
    /**
   * Called when the script is about to run for the first time.
   */ initialize() {
        // Створюємо CompositionManager script
        this.entity.script.create("compositionManager");
        // Створюємо дефолтний Composition та реєструємо aggregation handlers
        this._initializeCompositions();
        this.app.sceneManager = this;
        const cameraEntity = this.app.root.findComponent("camera").entity;
        if (cameraEntity) {
            this.plusManager = new PlusButtonManager(this.app, cameraEntity);
            this.updateButtonsPositions();
        }
        // Initialize Dimension System
        if (cameraEntity) {
            this.app.dimensionSystem = new DimensionSystem(this.app, cameraEntity);
            this.app.on('update', ()=>this.app.dimensionSystem?.update());
        }
        this.app.dividerFacade = DividerFacade.init(CompositionManager.instance);
        // Initialize AR Export Service
        this.app.arExportService = new ARExportService(this.app);
        // Camera Controller буде ініціалізовано в GlobalBridge
        // Тут не створюємо окремий CameraFramingService
        // Initialize Drawer Animation Service
        this.app.drawerAnimationService = new DrawerAnimationService(this.app);
        // Initialize Drawer View Service (використовує CameraController для роботи з камерою)
        this.app.drawerViewService = new DrawerViewService(this.app, this.app.cameraController);
        this.app.drawerViewService.setAnimationService(this.app.drawerAnimationService);
        this.app.drawerOverlaySystem = new DrawerOverlaySystem(this.app, cameraEntity);
        this.app.dividerSlotOverlaySystem = new DividerSlotOverlaySystem(this.app, cameraEntity);
        // this.app.drawerOverlaySystem.setEnabled(true);
        this.app.drawerViewService.subscribe((isActive, cabinetId, drawerType)=>{
            const dividerOverlaySystem = this.app.dividerSlotOverlaySystem;
            const wasDividerOverlayActive = Boolean(dividerOverlaySystem?._isActive);
            const previousDividerOverlayOptions = dividerOverlaySystem?._activeOverlayOptions ? {
                ...dividerOverlaySystem._activeOverlayOptions
            } : {};
            // Визначаємо правильний drawerType на основі конфігурації продукту
            let actualDrawerType = drawerType;
            if (isActive && drawerType === 'Top') {
                // Отримуємо конфіг продукту з CompositionManager
                const compositionManager = CompositionManager.instance;
                const composition = compositionManager?.getActiveComposition();
                const productConfig = composition?.getProduct(cabinetId);
                // Використовуємо topDrawerType з конфігурації продукту (TopFull для Sink-Cabinet)
                if (productConfig?.topDrawerType) {
                    actualDrawerType = productConfig.topDrawerType;
                }
            }
            this.app.drawerOverlaySystem.handleViewStateChange(isActive, cabinetId, actualDrawerType);
            // Activate/deactivate divider overlay system
            if (isActive) {
                if (wasDividerOverlayActive) {
                    DividerDebugLogger.log('ResizeOverlayCase.sceneManagerRestoreOverlay', 'Restoring divider overlay after drawer view state change', {
                        cabinetId,
                        drawerType,
                        actualDrawerType,
                        previousDividerOverlayOptions
                    });
                    dividerOverlaySystem.activateDrawer(cabinetId, actualDrawerType, previousDividerOverlayOptions);
                } else {
                    DividerDebugLogger.log('ResizeOverlayCase.sceneManagerSkipOverlay', 'Skipped automatic divider overlay activation because overlay was inactive before drawer view state change', {
                        cabinetId,
                        drawerType,
                        actualDrawerType
                    });
                }
            } else {
                dividerOverlaySystem.deactivate();
            }
        });
        LoggerService.log(this, "🎬 [SceneManager] Initialized and listening for 'scene:add-product'");
    }
    /**
   * Ініціалізація композицій та aggregation handlers
   */ _initializeCompositions() {
        const compositionManager = CompositionManager.instance;
        if (!compositionManager) {
            LoggerService.warn(this, "[SceneManager] CompositionManager not initialized");
            return;
        }
        // Створюємо дефолтну колекцію для шаф
        compositionManager.createComposition("cabinets", "cabinets");
        compositionManager.setActiveComposition("cabinets");
        // Реєструємо aggregation handlers
        this._registerAggregationHandlers();
        LoggerService.log(this, "✅ [SceneManager] Collections initialized");
    }
    /**
   * Реєстрація handlers для scene entities (стільниця, освітлення)
   */ _registerAggregationHandlers() {
        const compositionManager = CompositionManager.instance;
        // Handler для стільниці: агрегує Width і Depth всіх продуктів
        compositionManager.registerAggregationHandler("countertop-dimensions", {
            watchCompositions: [
                "cabinets"
            ],
            watchParams: [
                "Width",
                "Depth"
            ],
            aggregateFn: (compositions)=>{
                const cabinets = compositions["cabinets"];
                if (!cabinets) return null;
                const products = Object.values(cabinets.getAllProducts());
                if (products.length === 0) {
                    return {
                        totalWidth: 0,
                        maxDepth: 0,
                        count: 0
                    };
                }
                return {
                    totalWidth: products.reduce((sum, p)=>sum + (p.Width || 0), 0),
                    maxDepth: Math.max(...products.map((p)=>p.Depth || 0), 0),
                    count: products.length
                };
            },
            applyFn: (result, context)=>{
            // if (!result || result.count === 0) return;
            // const countertop = context.app.root.findByName('Countertop');
            // if (!countertop) {
            //   LoggerService.warn(
            //     this,
            //     "[SceneManager] Countertop entity not found. Create it to see aggregation in action."
            //   );
            //   return;
            // }
            // // Оновлюємо розмір стільниці
            // const scale = countertop.getLocalScale();
            // countertop.setLocalScale(
            //   result.totalWidth / 100,  // базова ширина 100см
            //   scale.y,
            //   result.maxDepth / 50      // базова глибина 50см
            // );
            // LoggerService.log(
            //   this,
            //   `🪑 [Countertop] Updated: ${result.totalWidth} x ${result.maxDepth} cm (${result.count} products)`
            // );
            }
        });
        LoggerService.log(this, "✅ [SceneManager] Registered 2 aggregation handlers (countertop, lighting)");
    }
    /**
   * Видаляє всі продукти (нова архітектура)
   */ async removeAllProducts() {
        const compositionManager = CompositionManager.instance;
        if (!compositionManager) {
            LoggerService.error(this, "[SceneManager] CompositionManager not available");
            return;
        }
        compositionManager.assertCompositionMutable?.();
        const targetIds = Object.keys(compositionManager.getActiveComposition()?.getAllProducts?.() ?? {});
        let primaryError = null;
        compositionManager.aggregator.beginBatch();
        try {
            // Await owned derived cleanup before changing selection or target roots.
            await compositionManager.clearComposition();
            this.app.selectTool.deselectAll();
            this.app.selectTool.clearOutline();
            // clearComposition normally destroys these roots. This target-scoped fallback
            // retains the old ProductFactory cleanup without touching another composition.
            for (const productId of targetIds){
                if (this.app.root.findByName(productId)) {
                    new ProductFactory().removeProduct(productId);
                }
            }
        } catch (error) {
            primaryError = error;
            throw error;
        } finally{
            try {
                await compositionManager.aggregator.endBatch();
            } catch (batchError) {
                if (!primaryError) throw batchError;
                LoggerService.error(this, '[SceneManager] Failed to close remove-all batch', batchError);
            }
        }
        this.updateButtonsPositions();
        LoggerService.log(this, `✅ [SceneManager] All products removed via CompositionManager`);
    }
    // ====== NEW ARCHITECTURE (v2 методи) ======
    /**
   * Додає продукт з використанням CompositionManager (нова архітектура)
   * @param {string} assetName - Назва asset (тип продукту)
   * @param {string|null} prevEntityId - ID попереднього entity (null = додати в кінець)
   * @param {string} side - 'left' або 'right'
   * @param {Object} initialConfig - Початкова конфігурація продукту
   * @returns {Promise<string>} - ID створеного entity
   */ async addProductByParams(assetName, prevEntityId = null, side = "right", initialConfig = {}) {
        const compositionManager = CompositionManager.instance;
        if (isCabinetCoverProduct(initialConfig, assetName)) {
            throw derivedCoverError();
        }
        if (!compositionManager) {
            LoggerService.error(this, "[SceneManager] CompositionManager not available");
            return null;
        }
        compositionManager.assertCompositionMutable?.(compositionManager._activeCompositionId);
        // 1. Конфігурація нового продукту (наслідуємо shared params від існуючих кабінетів)
        const config = this._newProductConfig(assetName, initialConfig);
        // 2. UF ряд: високі тумби стоять одним блоком. Плюсик там схований, але API можна викликати напряму,
        //    тож вставка, що ламає блок, відмовляє помилкою UF_HEIGHT_RUN_VIOLATION (не тихий null).
        assertUFInsert(compositionManager, config, prevEntityId, side);
        try {
            // 3. Створення entity
            const entity = await new ProductFactory().createProductEntity(assetName);
            if (!entity) {
                LoggerService.error(this, `[SceneManager] Failed to create entity for "${assetName}"`);
                return null;
            }
            this.app.root.addChild(entity);
            // 3.1. Генерація дефолтних divider slots
            this._initDividerConfig(config, assetName);
            // 4. Додавання через CompositionManager (включає позиціювання)
            await compositionManager.addProductWithLayout(entity, config, {
                prevEntityId,
                side
            });
            // Mirror Side-Shelf based on edge position (left edge → face left)
            this._updateSideShelfOrientation();
            LoggerService.log(this, `✅ [SceneManager] Product "${entity.name}" added via CompositionManager`);
            this._frameCameraOnComposition();
            this.app.dimensionSystem?.refresh();
            return entity.name;
        } catch (error) {
            LoggerService.error(this, `[SceneManager] Error adding product: ${error.message}`);
            return null;
        }
    }
    /**
   * Додає продукт зліва (нова архітектура)
   * @param {string} assetName - Тип продукту
   * @param {object} [initialConfig={}] - Початкова конфігурація
   */ async addProductByLeft(assetName, initialConfig = {}) {
        const compositionManager = CompositionManager.instance;
        const composition = compositionManager?.getActiveComposition();
        if (!composition) {
            return await this.addProductByParams(assetName, null, "left", initialConfig);
        }
        const products = composition.getAllProducts();
        const productIds = Object.keys(products);
        if (productIds.length === 0) {
            return await this.addProductByParams(assetName, null, "left", initialConfig);
        }
        // Знаходимо перший продукт за orderIndex
        const orderIds = composition.getOrderProductIds();
        const firstProductId = productIds.reduce((first, id)=>{
            const currentIndex = orderIds[id] ?? Infinity;
            const firstIndex = orderIds[first] ?? Infinity;
            return currentIndex < firstIndex ? id : first;
        }, productIds[0]);
        return await this.addProductByParams(assetName, firstProductId, "left", initialConfig);
    }
    /**
   * Додає продукт справа (нова архітектура)
   * @param {string} assetName - Тип продукту
   * @param {object} [initialConfig={}] - Початкова конфігурація
   */ async addProductByRight(assetName, initialConfig = {}) {
        const compositionManager = CompositionManager.instance;
        const composition = compositionManager?.getActiveComposition();
        if (!composition) {
            return await this.addProductByParams(assetName, null, "right", initialConfig);
        }
        const products = composition.getAllProducts();
        const productIds = Object.keys(products);
        if (productIds.length === 0) {
            return await this.addProductByParams(assetName, null, "right", initialConfig);
        }
        // Знаходимо останній продукт за orderIndex
        const orderIds = composition.getOrderProductIds();
        const lastProductId = productIds.reduce((last, id)=>{
            const currentIndex = orderIds[id] ?? -Infinity;
            const lastIndex = orderIds[last] ?? -Infinity;
            return currentIndex > lastIndex ? id : last;
        }, productIds[0]);
        return await this.addProductByParams(assetName, lastProductId, "right", initialConfig);
    }
    /**
   * Видаляє продукт (нова архітектура)
   */ removeProduct(id) {
        const compositionManager = CompositionManager.instance;
        if (!compositionManager) {
            LoggerService.error(this, "[SceneManager] CompositionManager not available");
            return null;
        }
        const snapshot = compositionManager.getActiveComposition()?.getProduct?.(id);
        if (isCabinetCoverProduct(snapshot)) throw derivedCoverError();
        compositionManager.assertCompositionMutable?.(compositionManager._activeCompositionId);
        if (this._isManagedCountertop(id)) {
            LoggerService.warn(this, `[SceneManager] Refusing manual remove of countertop "${id}". ` + `Countertop is auto-managed when all cabinets are removed.`);
            return null;
        }
        // 1. Видаляємо з композиції (БЕЗ recalculateLayout — entity ще в scene)
        compositionManager.removeProductFromComposition(compositionManager._activeCompositionId, id);
        this.app.selectTool.setSelectedByName(id, {
            mode: "remove"
        });
        // 2. Видаляємо entity зі scene
        const entity = new ProductFactory().removeProduct(id);
        // 3. Тепер recalculateLayout — entity вже видалений зі scene.
        //    notifyRules=false: step 4 reruns every rule (incl. regrouped SupportGroupId) once.
        compositionManager.recalculateLayout(null, {
            notifyRules: false
        });
        // 4. FIX: Перезапускаємо composition rules з ОНОВЛЕНИМИ позиціями кабінетів.
        //    Без цього RuleCountertopLayout має stale targetX (обчислений до recalculateLayout).
        compositionManager.aggregator.onCompositionStructureChanged(compositionManager._activeCompositionId, compositionManager.getAllCompositions());
        // Re-check Side-Shelf orientation after removal (edge may have changed)
        this._updateSideShelfOrientation();
        this.updateButtonsPositions();
        this._frameCameraOnComposition();
        this.app.dimensionSystem?.refresh();
        LoggerService.log(this, `✅ [SceneManager] Product "${id}" removed via CompositionManager`);
        return entity;
    }
    _isManagedCountertop(id) {
        if (typeof id !== 'string') return false;
        if (id.startsWith('Top_Solid')) return true;
        return ProductRegistry_V2.instance.detectProductType(id) === 'Top_Solid';
    }
    /**
   * Створення пресету продуктів з конфігурацією
   * @param {Array<{name: string, ...config}>} items - Масив продуктів з конфігурацією
   * @param {object} [globalConfig] - Глобальна конфігурація для всіх продуктів
   *
   * @example
   * // Конфігурація безпосередньо в об'єкті
   * presetProducts([{name: 'CabinetUniBox', Height: 53, Depth: 46}])
   *
   * // З глобальною конфігурацією
   * presetProducts(
   *   [{name: 'CabinetUniBox'}, {name: 'UniOpenShelves'}],
   *   {Height: 53, Depth: 46}
   * )
   *
   * // Комбінований підхід
   * presetProducts(
   *   [{name: 'CabinetUniBox', Width: 120}, {name: 'UniOpenShelves'}],
   *   {Height: 53, Depth: 46}
   * )
   */ async presetProducts(items, globalConfig = {}) {
        const compositionManager = CompositionManager.instance;
        if (!compositionManager) {
            LoggerService.error(this, "[SceneManager] CompositionManager not available");
            return;
        }
        if ((items ?? []).some((item)=>isCabinetCoverProduct(item, item?.name)) || isCabinetCoverProduct(globalConfig, globalConfig?.productType ?? null)) {
            throw derivedCoverError();
        }
        compositionManager.assertCompositionMutable?.(compositionManager._activeCompositionId);
        const createdProducts = [];
        const targetIds = Object.keys(compositionManager.getActiveComposition()?.getAllProducts?.() ?? {});
        let primaryError = null;
        compositionManager.aggregator.beginBatch();
        try {
            // 1. Await target-owned cleanup before replacing primary products.
            await compositionManager.clearComposition();
            this.app.selectTool.setSelectedByName([], {
                mode: "replace"
            });
            for (const productId of targetIds){
                if (this.app.root.findByName(productId)) {
                    new ProductFactory().removeProduct(productId);
                }
            }
            // 2. Створення продуктів
            let prevEntityId = null;
            for (const item of items){
                if (!item || !item.name) continue;
                const { name, ...itemConfig } = item;
                const productMeta = ProductRegistry_V2.instance.getProductConfig(name) || {};
                const config = {
                    ...this._getDefaultConfig(),
                    ...productMeta.defaultConfig,
                    ...globalConfig || {},
                    ...itemConfig,
                    productType: productMeta.productType || null,
                    entityName: name,
                    category: productMeta.category || null
                };
                this._initDividerConfig(config, name);
                try {
                    const entity = await new ProductFactory().createProductEntity(name);
                    if (!entity) continue;
                    this.app.root.addChild(entity);
                    await compositionManager.addProductWithLayout(entity, config, {
                        prevEntityId: prevEntityId,
                        side: "right"
                    });
                    createdProducts.push(entity.name);
                    prevEntityId = entity.name;
                } catch (error) {
                    LoggerService.error(this, `[SceneManager] Error creating "${name}": ${error.message}`);
                }
            }
        } catch (error) {
            primaryError = error;
            throw error;
        } finally{
            // Aggregation must leave batch mode even when cover teardown or creation fails.
            try {
                await compositionManager.aggregator.endBatch();
            } catch (batchError) {
                if (!primaryError) throw batchError;
                LoggerService.error(this, '[SceneManager] Failed to close preset batch', batchError);
            }
        }
        // Mirror Side-Shelf based on edge position (left edge → face left)
        this._updateSideShelfOrientation();
        this._frameCameraOnComposition();
        this.app.dimensionSystem?.refresh();
        LoggerService.log(this, `✅ [SceneManager] Preset applied: ${createdProducts.length} products created via CompositionManager`);
        return createdProducts;
    }
    /**
   * Swap продуктів (нова архітектура)
   */ swapProducts(entityNameA, entityNameB) {
        const compositionManager = CompositionManager.instance;
        if (!compositionManager) {
            LoggerService.error(this, "[SceneManager] CompositionManager not available");
            return false;
        }
        // UF ряд: обмін, після якого коротка тумба опиниться між високими, відмовляє (UF_HEIGHT_RUN_VIOLATION).
        assertUFSwap(compositionManager, entityNameA, entityNameB);
        const success = compositionManager.swapProducts(entityNameA, entityNameB);
        // Re-check Side-Shelf orientation after swap (edge may have changed)
        this._updateSideShelfOrientation();
        this._frameCameraOnComposition();
        if (success) {
            LoggerService.log(this, `✅ [SceneManager] Products swapped: "${entityNameA}" <-> "${entityNameB}"`);
        }
        return success;
    }
    /**
   *
   * @param {(entityName, side) => void} callback
   */ setHandleButtonClick(callback) {
        this.plusManager.setHandleButtonClick(callback);
    }
    updateButtonsPositions() {
        const compositionManager = CompositionManager.instance;
        const entitiesCabinet = compositionManager.getProductEntitiesByCategory("cabinets");
        if (entitiesCabinet.length === 0) {
            this.plusManager.showEmptyState();
            return;
        }
        let anchors = AnchorCalculator.calculateAnchors(entitiesCabinet);
        const buttonMode = this.plusManager.buttonMode;
        // Column rows (Urban Duplex): row ends on the floor and from the plane, plus "top"/"bottom" to finish a column.
        // On any failure the legacy row-end "+" below are used.
        const columnsLayout = compositionManager.freeLayoutPolicy?.columns === true;
        const columnPlusSet = columnsLayout && this._setColumnPlusButtons(compositionManager, entitiesCabinet);
        // The column "+" are already in the plus manager; otherwise the row-end or the legacy "+" are set here.
        if (!columnPlusSet) {
            if (compositionManager.preserveCabinetPositions) {
                // Modular (free layout, ULH): "+" only at free row ends, rows from the placed geometry
                // (a Drag & Drop cabinet gets its own "+"); several rows keep their own right "+".
                anchors = this._rowEndAnchors(anchors, entitiesCabinet);
                this.plusManager.setAnchors(anchors, {
                    multiRow: true
                });
            } else {
                // Застосовуємо правила блокування кнопок по режиму
                this._applyButtonRules(anchors, compositionManager, buttonMode, this.plusManager.buttonDraftConfig);
                this.plusManager.setAnchors(anchors);
            }
        }
        if (this.app.drawerOverlaySystem) {
            this.app.drawerOverlaySystem.rescan();
        }
    }
    /**
   * Column "+" buttons for a policy whose rows hold columns (`columns: true`) (column-plus-anchors.mjs).
   * 1. Rows and the cabinet boxes they were read from come from the policy (policy.columnRows()): one measurement.
   * 2. The floor is the only obstacle, as in _rowEndAnchors.
   * 3. Unavailable "+" get no button; the UI filters the rest (ConfiguratorAPI.plusButtons).
   * @returns {boolean} false on any failure, so the caller falls back to the legacy row-end "+"
   */ _setColumnPlusButtons(compositionManager, entities) {
        try {
            const columns = compositionManager.freeLayoutPolicy.columnRows();
            // No column rows yet (nothing measured, or the policy does not own the composition): keep the legacy "+".
            if (!columns?.rows.length) return false;
            const plusList = planColumnPlusButtons({
                rows: columns.rows,
                boxes: columns.boxes,
                obstacles: this._floorObstacles()
            });
            this.plusManager.setPlusButtons(plusList, {
                entities
            });
            return true;
        } catch (error) {
            LoggerService.warn(this, '[SceneManager] column "+" buttons failed; legacy row-end "+" kept', error);
            return false;
        }
    }
    /** The floor as a placement obstacle ([] when the room has no floor collider). */ _floorObstacles() {
        const floor = measureFloorColliderBox(this.app);
        if (!floor) return [];
        return [
            {
                id: FLOOR_COLLIDER_ID,
                box: floor
            }
        ];
    }
    /** Row-end "+" anchors for free-layout compositions; falls back to the legacy anchors on any failure. */ _rowEndAnchors(anchors, entities) {
        try {
            const cabinets = entities.map((entity)=>{
                const box = measureEntityBoundsM(entity);
                const p = entity.getPosition();
                return box ? {
                    id: entity.name,
                    box,
                    pivotM: {
                        x: p.x,
                        y: p.y,
                        z: p.z
                    }
                } : null;
            }).filter(Boolean);
            return rowEndPlusAnchors(anchors, cabinets, this._floorObstacles());
        } catch (error) {
            LoggerService.warn(this, '[SceneManager] row-end "+" anchors failed; legacy anchors kept', error);
            return anchors;
        }
    }
    /**
   * Застосовує правила блокування "+" кнопок залежно від режиму.
   *
   * @param {Array} anchors
   * @param {CompositionManager} compositionManager
   * @param {string|null} buttonMode - null = cabinets, 'Side-Shelf' = Side-Shelf позиції
   * @param {{Height?, Handle?}|null} [draftConfig] - висота / ручка тумби, яку ставлять (UF ряд, setVisibleButtons)
   * @private
   */ _applyButtonRules(anchors, compositionManager, buttonMode, draftConfig = null) {
        if (!anchors || anchors.length === 0) return;
        const composition = compositionManager.getActiveComposition();
        if (!composition) return;
        const orderIds = composition.getOrderProductIds();
        const sorted = anchors.filter((a)=>a.entity).sort((a, b)=>(orderIds[a.entity.name] ?? 0) - (orderIds[b.entity.name] ?? 0));
        if (sorted.length === 0) return;
        const isSideShelf = (anchor)=>anchor.entity.name.startsWith('Side-Shelf');
        if (buttonMode === 'Side-Shelf') {
            // Режим Side-Shelf: показуємо "+" тільки на крайніх позиціях (де ще немає Side-Shelf)
            for(let i = 0; i < sorted.length; i++){
                const current = sorted[i];
                const isLeftEdge = i === 0;
                const isRightEdge = i === sorted.length - 1;
                if (isSideShelf(current)) {
                    // Side-Shelf вже є — блокуємо всі кнопки
                    current.left = null;
                    current.right = null;
                } else if (isLeftEdge && isRightEdge) ; else if (isLeftEdge) {
                    // Крайній лівий кабінет — показуємо тільки ліву "+" (додати Side-Shelf зліва)
                    current.right = null;
                } else if (isRightEdge) {
                    // Крайній правий кабінет — показуємо тільки праву "+" (додати Side-Shelf справа)
                    current.left = null;
                } else {
                    // Середній кабінет — Side-Shelf не може бути в середині
                    current.left = null;
                    current.right = null;
                }
            }
        } else {
            // Режим cabinets (default): Side-Shelf блокує тільки зовнішню кнопку
            for(let i = 0; i < sorted.length; i++){
                const current = sorted[i];
                if (isSideShelf(current)) {
                    if (i === 0) current.left = null; // лівий край → блокуємо ліву
                    if (i === sorted.length - 1) current.right = null; // правий край → блокуємо праву
                }
            }
        }
        // UF ряд: "+" лишається тільки там, де нова тумба не розірве блок високих, і стоїть на її висоті
        // (поверх правил вище). Висоту / ручку, яких UI не передав, нова тумба бере з ряду, як в addProductByParams.
        if (draftConfig) {
            applyUFPlusRule(sorted, compositionManager, {
                ...this._getSharedParamsFromComposition(),
                ...draftConfig
            });
        }
    }
    /**
   * Віддзеркалює Side-Shelf залежно від його позиції на краю композиції.
   * - Лівий край: scale(-1, 1, 1) — полиці дивляться вліво
   * - Правий край: scale(1, 1, 1) — полиці дивляться вправо (дефолт)
   * @private
   */ _updateSideShelfOrientation() {
        const compositionManager = CompositionManager.instance;
        const composition = compositionManager?.getActiveComposition();
        if (!composition) return;
        const orderIds = composition.getOrderProductIds();
        const cabinets = compositionManager.getProductEntitiesByCategory("cabinets");
        if (cabinets.length === 0) return;
        // Sort by order index to determine edges
        const sorted = [
            ...cabinets
        ].sort((a, b)=>(orderIds[a.name] ?? 0) - (orderIds[b.name] ?? 0));
        const leftEdgeEntity = sorted[0];
        cabinets.forEach((entity)=>{
            if (!entity.name.startsWith("Side-Shelf")) return;
            const scale = entity.getLocalScale();
            if (entity === leftEdgeEntity) {
                // Left edge → mirror so shelves face outward (left)
                if (scale.x !== -1) {
                    entity.setLocalScale(-1, scale.y, scale.z);
                }
            } else {
                // Right edge or middle → default orientation (shelves face right)
                if (scale.x !== 1) {
                    entity.setLocalScale(1, scale.y, scale.z);
                }
            }
        });
    }
    /**
   * Повна конфігурація нового продукту: дефолти → дефолти продукту → shared params композиції → initialConfig.
   * @param {string} assetName - Тип продукту
   * @param {object} initialConfig - Початкова конфігурація від API
   * @private
   */ _newProductConfig(assetName, initialConfig) {
        const productMeta = ProductRegistry_V2.instance.getProductConfig(assetName) || {};
        return {
            ...this._getDefaultConfig(),
            ...productMeta.defaultConfig,
            ...this._getSharedParamsFromComposition(),
            ...initialConfig,
            productType: productMeta.productType || null,
            entityName: assetName,
            category: productMeta.category || null
        };
    }
    /**
   * Отримує дефолтну конфігурацію продукту
   * @private
   */ _getDefaultConfig() {
        return {
            Width: 60,
            Height: 56,
            Depth: 46
        };
    }
    /**
   * Бере shared параметри (Height, Handle, Thickness) від першого існуючого кабінету.
   * Новий кабінет успадковує глобальні налаштування композиції; UI міняє ручку на всіх тумбах,
   * а у UF від Handle залежать фронти (Central Groove на 91), тож нова тумба має взяти ту саму ручку.
   * @private
   */ _getSharedParamsFromComposition() {
        const compositionManager = CompositionManager.instance;
        const composition = compositionManager?.getActiveComposition();
        if (!composition) return {};
        const products = composition.getAllProducts();
        const firstProduct = Object.values(products).find((p)=>p.category === 'cabinets');
        if (!firstProduct) return {};
        const SHARED_KEYS = [
            'Height',
            'Handle',
            'Thickness'
        ];
        const result = {};
        for (const key of SHARED_KEYS){
            if (firstProduct[key] !== undefined) {
                result[key] = firstProduct[key];
            }
        }
        return result;
    }
    /**
   * Генерує дефолтну конфігурацію дівайдерів для продукту
   * @param {Object} config - конфіг продукту (повинен мати Width)
   * @param {string} assetName - назва asset
   * @returns {Object} config з доданими TopDrawerDividers / BotDrawerDividers
   * @private
   */ _initDividerConfig(config, assetName) {
        const traceId = DividerDebugLogger.nextTraceId('divider-init');
        const productMeta = ProductRegistry_V2.instance.getProductConfig(assetName) || {};
        const facade = this.app.dividerFacade;
        // Визначаємо тип верхньої шухляди на основі конфігу або default 'Top'
        const topDrawerType = productMeta.defaultConfig?.topDrawerType || 'Top';
        config.topDrawerType = topDrawerType;
        config.TopDrawerDividers = facade.generateSlots(config.Width, topDrawerType, {});
        config.BotDrawerDividers = facade.generateSlots(config.Width, 'Bot', {});
        DividerDebugLogger.log('SceneManager._initDividerConfig', 'Initial divider config generated for product', {
            traceId,
            assetName,
            width: config.Width,
            topDrawerType,
            product: DividerDebugLogger.summarizeProduct(assetName, config)
        });
        return config;
    }
    _frameCameraOnComposition() {
        // Центруємо камеру тільки по кабінетах — вони є source of truth для позицій.
        // Стільниця, side panels, towel bars позиціюються composition rules асинхронно,
        // тому їх AABB може бути застарілим в момент виклику цього методу.
        const compositionManager = CompositionManager.instance;
        const cabinetEntities = compositionManager?.getProductEntitiesByCategory("cabinets") || [];
        if (cabinetEntities.length === 0) {
            LoggerService.log(this, "⚠️ [SceneManager] No cabinet entities for camera framing");
            return;
        }
        const cameraEntity = this.app.root.findByName("Camera") || this.app.root.findComponent("camera")?.entity;
        if (this.app.cameraController) {
            this.app.cameraController.focusOnEntities(cabinetEntities, cameraEntity, {
                force: true
            });
        } else {
            LoggerService.warn(this, "⚠️ [SceneManager] CameraController not initialized");
        }
    }
}
_define_property(SceneManager, "scriptName", "sceneManager");

export { SceneManager };
