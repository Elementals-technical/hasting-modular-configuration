import { LoggerService } from '../../services/logger/logger-service.mjs';
import { DividerFacade } from '../../services/drawer-divider/DividerFacade.mjs';
import { DividerDebugLogger } from '../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';
import { DividerViewGuard } from '../helpers/divider-view-guard.mjs';
import { isCabinetCoverProduct } from '../../domain/countertop/countertop-role.mjs';
import { configForShortUFCabinet } from '../../domain/cabinet-placement/uf-height-run-policy.mjs';

const PRIVATE_COUNTERTOP_CONFIG_KEY = 'CountertopLengthM';
const hasPrivateCountertopConfig = (config)=>Boolean(config && (typeof config.has === 'function' && config.has(PRIVATE_COUNTERTOP_CONFIG_KEY) || Object.prototype.hasOwnProperty.call(config, PRIVATE_COUNTERTOP_CONFIG_KEY)));
const rejectPrivateCountertopConfig = (config)=>{
    if (!hasPrivateCountertopConfig(config)) return;
    const error = new Error(`${PRIVATE_COUNTERTOP_CONFIG_KEY} is private; use ConfiguratorAPI.countertop.setSize()`);
    error.code = 'COUNTERTOP_PRIVATE_CONFIG';
    error.field = PRIVATE_COUNTERTOP_CONFIG_KEY;
    throw error;
};
const redactPrivateCountertopConfig = (config)=>{
    if (!hasPrivateCountertopConfig(config)) return config;
    const values = typeof config.getAll === 'function' ? config.getAll() : config;
    const publicConfig = {
        ...values
    };
    delete publicConfig[PRIVATE_COUNTERTOP_CONFIG_KEY];
    return publicConfig;
};
const isDerivedCover = (snapshot, productType = null)=>isCabinetCoverProduct(snapshot, productType);
const rejectDerivedCover = (snapshot, productType = null)=>{
    if (!isDerivedCover(snapshot, productType)) return;
    throw Object.assign(new Error('Cabinet_Cover products are derived and read-only'), {
        code: 'CABINET_COVER_DERIVED_READ_ONLY'
    });
};
/**
 * Product Config Plugin для ConfiguratorAPI.
 *
 * Інкапсулює setConfig, setConfigBatch, getConfig.
 * Включає private helpers: _resolveSidePanelSide, _handleDividerResize, _updateDividerSlot.
 */ class ProductConfigPlugin {
    /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object}
   */ static create(ctx) {
        const { app, bridge } = ctx;
        /** Helper: повертає SceneManager */ const _sm = ()=>{
            if (!app.sceneManager) throw new Error("SceneManager is not initialized yet!");
            return app.sceneManager;
        };
        /** Helper: повертає CompositionManager або null */ const _cm = ()=>{
            if (!app.compositionManager) {
                LoggerService.error(bridge, '[Bridge] CompositionManager not available');
                return null;
            }
            return app.compositionManager;
        };
        return {
            /**
       * Оновлення конфігурації одного продукту
       * @param {string} productId - ID продукту
       * @param {object} config - Об'єкт змін
       * @returns {Promise<{success: boolean, dividerConflicts: Array}>}
       */ setConfig: async (productId, config)=>{
                rejectPrivateCountertopConfig(config);
                LoggerService.log(bridge, `[API] setConfig`, {
                    productId,
                    config
                });
                const compositionManager = _cm();
                if (!compositionManager) return false;
                const composition = compositionManager.getActiveComposition();
                if (!composition) {
                    LoggerService.error(bridge, '[Bridge] No active composition');
                    return false;
                }
                compositionManager.assertCompositionMutable?.(composition.compositionId);
                const currentConfig = composition.getProduct(productId);
                if (!currentConfig) {
                    LoggerService.error(bridge, `[Bridge] Product "${productId}" not found`);
                    return false;
                }
                rejectDerivedCover(currentConfig);
                const updatedConfig = {
                    ...currentConfig,
                    ...config
                };
                const sizeChanged = config.Width !== undefined || config.Height !== undefined || config.Depth !== undefined;
                const dividerConfigTouched = config.TopDrawerDividers !== undefined || config.BotDrawerDividers !== undefined;
                const resizeTraceId = sizeChanged || dividerConfigTouched ? DividerDebugLogger.nextTraceId('resize-overlay-set-config') : null;
                if (resizeTraceId) {
                    DividerDebugLogger.log('ResizeOverlayCase.setConfigStart', 'Product config update may affect divider overlay', {
                        traceId: resizeTraceId,
                        productId,
                        config,
                        sizeChanged,
                        dividerConfigTouched,
                        current: DividerDebugLogger.summarizeProduct(productId, currentConfig),
                        runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, productId)
                    });
                }
                // Перерахувати дівайдери при зміні ширини тумби
                const resizeReport = ProductConfigPlugin._handleDividerResize(bridge, productId, currentConfig, config, updatedConfig);
                if (resizeTraceId) {
                    DividerDebugLogger.log('ResizeOverlayCase.setConfigResizeReport', 'Divider resize recalculation completed before guarded config update', {
                        traceId: resizeTraceId,
                        productId,
                        resizeReport,
                        updatedConfig,
                        runtimeAfterResizeReport: DividerDebugLogger.summarizeDrawerRuntime(app, productId)
                    });
                }
                // Виконуємо з автоматичним suspend/restore divider view
                return await DividerViewGuard.withSuspendedView(app, async ()=>{
                    // Виконуємо правила продукту
                    const entity = app.root.findByName(productId);
                    if (entity) {
                        await compositionManager._executeProductRules(entity, updatedConfig);
                        app.selectTool?.refreshOutline();
                    }
                    // Перераховуємо layout ПЕРЕД aggregator, щоб cab.getPosition()
                    // повертав актуальні позиції (важливо для Vessel cutout positioning)
                    if (sizeChanged) {
                        compositionManager.recalculateLayout();
                    }
                    // Оновлюємо в композиції (triggers aggregator → boolean cutouts)
                    const updated = compositionManager.updateProductInComposition(compositionManager._activeCompositionId, productId, config);
                    if (!updated) {
                        return {
                            success: false,
                            dividerConflicts: []
                        };
                    }
                    // ✅ Re-sync triplanar uniforms після size-change (див. коментар у setConfigBatch).
                    if (sizeChanged) {
                        ProductConfigPlugin._resyncAllTriplanarUniforms(compositionManager);
                    }
                    if (sizeChanged) {
                        app.dimensionSystem?.refresh();
                    }
                    // Оновити overlay якщо він активний (після resize позиції змінились)
                    if (resizeReport && app.dividerSlotOverlaySystem?._isActive) {
                        DividerDebugLogger.log('ResizeOverlayCase.setConfigRescanBefore', 'Rescanning divider overlay after product resize', {
                            traceId: resizeTraceId,
                            productId,
                            resizeReport,
                            runtimeBeforeRescan: DividerDebugLogger.summarizeDrawerRuntime(app, productId)
                        });
                        app.dividerSlotOverlaySystem.rescan();
                        DividerDebugLogger.log('ResizeOverlayCase.setConfigRescanAfter', 'Divider overlay rescan requested after product resize', {
                            traceId: resizeTraceId,
                            productId,
                            runtimeAfterRescan: DividerDebugLogger.summarizeDrawerRuntime(app, productId)
                        });
                    }
                    _sm().updateButtonsPositions();
                    // Оновлюємо drawer indicator після зміни конфігурації
                    app.drawerOverlaySystem?.rescan();
                    LoggerService.log(bridge, `[Bridge] Product "${productId}" updated`);
                    if (resizeTraceId) {
                        DividerDebugLogger.log('ResizeOverlayCase.setConfigDone', 'Product config update completed after possible divider resize', {
                            traceId: resizeTraceId,
                            productId,
                            sizeChanged,
                            dividerConfigTouched,
                            resizeReport,
                            runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, productId)
                        });
                    }
                    return {
                        success: true,
                        dividerConflicts: resizeReport?.conflicts || []
                    };
                });
            },
            /**
       * Масове оновлення конфігурації для групи продуктів
       * @param {object} options - Параметри групового оновлення
       * @param {object} config - Об'єкт змін
       */ setConfigBatch: async (options, config)=>{
                rejectPrivateCountertopConfig(config);
                LoggerService.log(bridge, `[API] setConfigBatch`, {
                    options,
                    config
                });
                const compositionManager = _cm();
                if (!compositionManager) return [];
                const activeComposition = compositionManager.getActiveComposition();
                compositionManager.assertCompositionMutable?.(activeComposition?.compositionId);
                rejectDerivedCover(null, options?.productType ?? null);
                for (const productId of options?.productIds ?? []){
                    rejectDerivedCover(activeComposition?.getProduct?.(productId));
                }
                if (options?.cabinetId) rejectDerivedCover(activeComposition?.getProduct?.(options.cabinetId));
                const batchSizeChanged = config.Width !== undefined || config.Height !== undefined || config.Depth !== undefined;
                const batchDividerConfigTouched = config.TopDrawerDividers !== undefined || config.BotDrawerDividers !== undefined;
                const batchResizeTraceId = batchSizeChanged || batchDividerConfigTouched ? DividerDebugLogger.nextTraceId('resize-overlay-set-config-batch') : null;
                if (batchResizeTraceId) {
                    DividerDebugLogger.log('ResizeOverlayCase.setConfigBatchStart', 'Batch config update may affect divider overlay', {
                        traceId: batchResizeTraceId,
                        options,
                        config,
                        batchSizeChanged,
                        batchDividerConfigTouched,
                        runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app)
                    });
                }
                // ✅ Divider slot оновлення не потребує suspend/restore drawer view
                if (options.cabinetId && options.drawerType && options.key && options.zone) {
                    return await ProductConfigPlugin._updateDividerSlot(compositionManager, options.cabinetId, options.drawerType, options.key, options.zone, config, options);
                }
                app.selectTool.setSelectedByName([], {
                    mode: 'replace'
                });
                // Виконуємо з автоматичним suspend/restore divider view
                return await DividerViewGuard.withSuspendedView(app, async ()=>{
                    // ✅ ОБРОБКА ПАРАМЕТРУ SidePanel
                    if (config.SidePanel !== undefined) {
                        const side = ProductConfigPlugin._resolveSidePanelSide(bridge, config, options, compositionManager);
                        await compositionManager.setSidePanelType(config.SidePanel, side);
                        LoggerService.log(bridge, `[Bridge] SidePanel set to "${config.SidePanel}" on side "${side}"`);
                        return true;
                    }
                    // ✅ ОБРОБКА ГЛОБАЛЬНОГО ПАРАМЕТРУ TowelBar
                    if (config.TowelBar !== undefined) {
                        const side = config.TowelBarSide || 'both';
                        await compositionManager.setTowelBarType(config.TowelBar, side);
                        LoggerService.log(bridge, `[Bridge] Global TowelBar set to "${config.TowelBar}" on side "${side}"`);
                        return true;
                    }
                    // ✅ ОБРОБКА ГЛОБАЛЬНОГО ПАРАМЕТРУ TowelBarColor
                    if (config.TowelBarColor !== undefined) {
                        await compositionManager.setTowelBarColor(config.TowelBarColor);
                        LoggerService.log(bridge, `[Bridge] Global TowelBarColor set to "${config.TowelBarColor}"`);
                        return true;
                    }
                    const composition = compositionManager.getActiveComposition();
                    if (!composition) {
                        LoggerService.error(bridge, '[Bridge] No active composition');
                        return [];
                    }
                    const allProducts = composition.getAllProducts();
                    let productIds = options.productIds || Object.keys(allProducts);
                    // Спільні параметри застосовуються до всіх первинних продуктів
                    // незалежно від productIds/productType.
                    const SHARED_PARAMS = [
                        'Height',
                        'CountertopColor'
                    ];
                    const hasSharedParams = SHARED_PARAMS.some((p)=>p in config);
                    if (hasSharedParams) {
                        productIds = Object.keys(allProducts);
                    }
                    productIds = productIds.filter((id)=>!isDerivedCover(allProducts[id]));
                    // Фільтр за типом продукту
                    if (options.productType && !hasSharedParams) {
                        productIds = productIds.filter((id)=>id.includes(options.productType));
                    }
                    const updatedIds = [];
                    const allDividerConflicts = [];
                    // Batch mode: збираємо aggregator виклики, виконуємо один раз після loop
                    compositionManager.aggregator.beginBatch();
                    // Оновлюємо кожен продукт
                    for (const productId of productIds){
                        const currentConfig = allProducts[productId];
                        if (!currentConfig) continue;
                        // A short UF cabinet keeps its own Height: the batch Height is the tall cabinets' one.
                        const productConfig = configForShortUFCabinet(currentConfig, config);
                        // Nothing left for this cabinet (the batch only set Height): its config stays as it is.
                        // It still counts as updated: the batch reached it, and callers check that every cabinet was.
                        if (Object.keys(productConfig).length === 0) {
                            updatedIds.push(productId);
                            continue;
                        }
                        const updatedConfig = {
                            ...currentConfig,
                            ...productConfig
                        };
                        // Перерахувати дівайдери при зміні ширини тумби
                        const resizeReport = ProductConfigPlugin._handleDividerResize(bridge, productId, currentConfig, productConfig, updatedConfig);
                        if (resizeReport?.conflicts?.length > 0) {
                            allDividerConflicts.push(...resizeReport.conflicts);
                        }
                        // Оновлюємо через існуючий метод
                        compositionManager.updateProductInComposition(compositionManager._activeCompositionId, productId, productConfig);
                        // Виконуємо правила (productConfig = тільки змінені поля, updatedConfig = повний стан)
                        const entity = app.root.findByName(productId);
                        if (entity) {
                            await compositionManager._executeProductRulesWithChanges(entity, productConfig, updatedConfig);
                            app.selectTool?.refreshOutline();
                        }
                        updatedIds.push(productId);
                    }
                    // Перераховуємо layout ПЕРЕД aggregator, щоб cab.getPosition()
                    // повертав актуальні позиції (важливо для Vessel cutout positioning)
                    const sizeChanged = batchSizeChanged;
                    if (sizeChanged && updatedIds.length > 0) {
                        compositionManager.recalculateLayout();
                    }
                    // Завершуємо batch: aggregator виконає handlers один раз з найсвіжішим станом
                    await compositionManager.aggregator.endBatch();
                    // ✅ Re-sync triplanar uniforms після size-change batch.
                    //
                    // Feature: triplanar-uniform-resync-on-size-change
                    // SmartStretch → meshBoolean.performBoolean() на double-rAF + каскад rules
                    // можуть залишити tri_rotation/tri_scale на shared material clones
                    // (див. applyTriplanar `_triplanar_unique` reuse) не синхронізованими із
                    // triPlanarMapping._rotationAngle. RuleGrainDirection не re-fire-ить на
                    // Height/Depth (його watchAttributes — ['GrainDirection','CabinetColor']),
                    // тож uniform лишається зіпсованим до наступного CabinetColor broadcast.
                    // Тут явно пересинхронізуємо uniforms із authoritative state скрипта.
                    if (sizeChanged && updatedIds.length > 0) {
                        ProductConfigPlugin._resyncAllTriplanarUniforms(compositionManager);
                    }
                    if (sizeChanged && updatedIds.length > 0) {
                        app.dimensionSystem?.refresh();
                    }
                    // Оновити overlay якщо він активний (після resize позиції змінились)
                    if (sizeChanged && app.dividerSlotOverlaySystem?._isActive) {
                        DividerDebugLogger.log('ResizeOverlayCase.setConfigBatchRescanBefore', 'Rescanning divider overlay after batch resize', {
                            traceId: batchResizeTraceId,
                            options,
                            config,
                            updatedIds,
                            runtimeBeforeRescan: DividerDebugLogger.summarizeDrawerRuntime(app)
                        });
                        app.dividerSlotOverlaySystem.rescan();
                        DividerDebugLogger.log('ResizeOverlayCase.setConfigBatchRescanAfter', 'Divider overlay rescan requested after batch resize', {
                            traceId: batchResizeTraceId,
                            updatedIds,
                            runtimeAfterRescan: DividerDebugLogger.summarizeDrawerRuntime(app)
                        });
                    }
                    _sm().updateButtonsPositions();
                    // Оновлюємо drawer indicator після batch update
                    app.drawerOverlaySystem?.rescan();
                    LoggerService.log(bridge, `[Bridge] Batch updated ${updatedIds.length} products`);
                    if (batchResizeTraceId) {
                        DividerDebugLogger.log('ResizeOverlayCase.setConfigBatchDone', 'Batch config update completed after possible divider resize', {
                            traceId: batchResizeTraceId,
                            updatedIds,
                            dividerConflicts: allDividerConflicts,
                            runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app)
                        });
                    }
                    return {
                        updatedIds,
                        dividerConflicts: allDividerConflicts
                    };
                });
            },
            /**
       * Отримання поточної конфігурації продукту
       * @param {string} productId - ID продукту
       * @returns {object|null}
       */ getConfig: (productId)=>{
                const compositionManager = _cm();
                if (!compositionManager) return null;
                const composition = compositionManager.getActiveComposition();
                if (!composition) {
                    LoggerService.warn(bridge, '[Bridge] No active composition');
                    return null;
                }
                const config = composition.getProduct(productId);
                if (!config) {
                    LoggerService.warn(bridge, `[Bridge] Product "${productId}" not found`);
                    return null;
                }
                LoggerService.log(bridge, `[Bridge] Config retrieved for "${productId}"`);
                return redactPrivateCountertopConfig(config);
            }
        };
    }
    // ====== PRIVATE HELPERS ======
    /**
   * Обходить subtree однієї або кількох entities та викликає updateUniforms()
   * на кожному triPlanarMapping скрипті. Використовується після size-change
   * або структурних змін композиції щоб перезаписати зіпсовані tri_* uniforms
   * authoritative значеннями зі script state.
   *
   * @param {pc.Entity|pc.Entity[]} rootEntities
   * @private
   */ static _resyncTriplanarUniforms(rootEntities) {
        const walk = (e)=>{
            e.script?.triPlanarMapping?.updateUniforms?.();
            e.children.forEach(walk);
        };
        const list = Array.isArray(rootEntities) ? rootEntities : [
            rootEntities
        ];
        list.forEach(walk);
    }
    /**
   * Re-sync triplanar uniforms на всіх cabinet-ах і countertop-ах композиції.
   * Використовується коли зміна могла зачіпити кілька entities одночасно
   * (size-change broadcast, add/remove product, composition rules cascade).
   *
   * @param {object} compositionManager
   * @private
   */ static _resyncAllTriplanarUniforms(compositionManager) {
        if (!compositionManager) return;
        const cabs = compositionManager.getProductEntitiesByCategory?.('cabinets') || [];
        const tops = compositionManager.getProductEntitiesByCategory?.('countertops') || [];
        ProductConfigPlugin._resyncTriplanarUniforms([
            ...cabs,
            ...tops
        ]);
    }
    /**
   * Визначає сторону для SidePanel з підтримкою legacy (cabinetId) та нового (SidePanelSide) API.
   * @private
   */ static _resolveSidePanelSide(bridge, config, options, compositionManager) {
        // 1. Новий API: явна сторона
        if (config.SidePanelSide) {
            return config.SidePanelSide;
        }
        // 2. Legacy API: конвертуємо cabinetId → side
        if (options.cabinetId) {
            const { leftCabinetId, rightCabinetId } = compositionManager.getEdgeCabinets();
            if (leftCabinetId === rightCabinetId) {
                return 'both';
            }
            if (options.cabinetId === leftCabinetId) return 'left';
            if (options.cabinetId === rightCabinetId) return 'right';
            LoggerService.warn(bridge, `[Bridge] Cabinet "${options.cabinetId}" is not an edge cabinet, applying to both sides`);
            return 'both';
        }
        // 3. Default
        return 'both';
    }
    /**
   * Перераховує дівайдери при зміні ширини тумби.
   * @private
   */ static _handleDividerResize(bridge, productId, currentConfig, newConfig, updatedConfig) {
        if (newConfig.Width === undefined || newConfig.Width === currentConfig.Width) {
            return null;
        }
        const traceId = DividerDebugLogger.nextTraceId('divider-width');
        DividerDebugLogger.log('ProductConfig._handleDividerResize', 'Width change detected for divider recalculation', {
            traceId,
            productId,
            previousWidth: currentConfig.Width,
            newWidth: newConfig.Width,
            current: DividerDebugLogger.summarizeProduct(productId, currentConfig)
        });
        const facade = DividerFacade.instance;
        if (!facade) {
            DividerDebugLogger.warn('ProductConfig._handleDividerResize', 'DividerFacade is not initialized', {
                traceId,
                productId
            });
            return null;
        }
        const resizeReport = facade.recalculateOnResize(productId, newConfig.Width);
        if (!resizeReport) {
            DividerDebugLogger.warn('ProductConfig._handleDividerResize', 'Resize report was not produced', {
                traceId,
                productId,
                newWidth: newConfig.Width
            });
            return null;
        }
        Object.assign(updatedConfig, resizeReport.changes);
        Object.assign(newConfig, resizeReport.changes);
        DividerDebugLogger.log('ProductConfig._handleDividerResize', 'Divider resize changes merged into config update', {
            traceId,
            productId,
            resizeReport
        });
        if (resizeReport.conflicts.length > 0) {
            LoggerService.warn(bridge, `[Bridge] Dividers resize (${currentConfig.Width}→${newConfig.Width}cm):`, resizeReport.conflicts);
        }
        return resizeReport;
    }
    /**
   * Оновлення конкретного слоту дівайдера
   * @private
   */ static async _updateDividerSlot(compositionManager, cabinetId, drawerType, key, zone, config, options = {}) {
        const facade = DividerFacade.instance;
        const newValue = config.value;
        const traceId = DividerDebugLogger.nextTraceId('divider-slot-config');
        DividerDebugLogger.log('ProductConfig._updateDividerSlot', 'Divider slot config update started', {
            traceId,
            cabinetId,
            drawerType,
            key,
            zone,
            zoneIndex: options?.zoneIndex,
            placementType: options?.placementType,
            canPlace: options?.canPlace,
            disabledReason: options?.disabledReason,
            config
        });
        DividerDebugLogger.log('ResizeOverlayCase.slotUpdateStart', 'Divider slot update started', {
            traceId,
            cabinetId,
            drawerType,
            key,
            zone,
            zoneIndex: options?.zoneIndex,
            placementType: options?.placementType,
            canPlace: options?.canPlace,
            disabledReason: options?.disabledReason,
            config
        });
        if (!facade) {
            DividerDebugLogger.error('ProductConfig._updateDividerSlot', 'DividerFacade is not initialized', {
                traceId,
                cabinetId,
                drawerType,
                key,
                zone,
                zoneIndex: options?.zoneIndex,
                placementType: options?.placementType,
                config
            });
            return false;
        }
        const app = compositionManager.app;
        const overlaySystem = app.dividerSlotOverlaySystem;
        const wasOverlayActive = Boolean(overlaySystem?._isActive);
        const activeOverlayOptions = overlaySystem?._activeOverlayOptions ? {
            ...overlaySystem._activeOverlayOptions
        } : {};
        const wasDrawerViewActive = Boolean(app.drawerViewService?.isTopViewActive?.());
        const wasDrawerOpen = Boolean(app.drawerAnimationService?.isDrawerOpen?.(cabinetId, drawerType));
        DividerDebugLogger.log('ProductConfig._updateDividerSlot', 'Updating divider slot without drawer view restart', {
            traceId,
            cabinetId,
            drawerType,
            wasOverlayActive,
            wasDrawerViewActive,
            wasDrawerOpen,
            activeOverlayOptions
        });
        DividerDebugLogger.log('ResizeOverlayCase.slotUpdateRuntimeBefore', 'Divider slot update runtime before overlay refresh', {
            traceId,
            cabinetId,
            drawerType,
            wasOverlayActive,
            wasDrawerViewActive,
            wasDrawerOpen,
            activeOverlayOptions,
            runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        if (wasOverlayActive) {
            DividerDebugLogger.log('ResizeOverlayCase.slotUpdateOverlayDeactivate', 'Temporarily deactivating overlay before slot update', {
                traceId,
                runtimeBeforeDeactivate: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
            });
            overlaySystem.deactivate();
        }
        app.selectTool?.deselectAll?.();
        app.selectTool?.clearOutline?.();
        let updated = false;
        try {
            updated = await facade.updateSlot(cabinetId, drawerType, key, zone, newValue, options);
        } catch (error) {
            if (wasOverlayActive && overlaySystem) {
                overlaySystem.activateDrawer(cabinetId, drawerType, {
                    ...activeOverlayOptions,
                    debugRequestId: options?.debugRequestId || traceId
                });
            }
            throw error;
        }
        if (wasOverlayActive && overlaySystem) {
            DividerDebugLogger.log('ResizeOverlayCase.slotUpdateOverlayRestoreBefore', 'Restoring divider overlay after slot update', {
                traceId,
                activeOverlayOptions,
                runtimeBeforeRestore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
            });
            overlaySystem.activateDrawer(cabinetId, drawerType, {
                ...activeOverlayOptions,
                debugRequestId: options?.debugRequestId || traceId
            });
            DividerDebugLogger.log('ResizeOverlayCase.slotUpdateOverlayRestoreAfter', 'Divider overlay restored after slot update', {
                traceId,
                runtimeAfterRestore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
            });
        } else if (updated) {
            await window.ConfiguratorAPI.dividers.showIconDividerSlots(cabinetId, drawerType, {
                show: true,
                selectedDividerType: options?.placementType || null,
                debugRequestId: options?.debugRequestId || traceId
            });
        }
        if (!updated) {
            DividerDebugLogger.warn('ProductConfig._updateDividerSlot', 'DividerFacade rejected slot update', {
                traceId,
                cabinetId,
                drawerType,
                key,
                zone,
                zoneIndex: options?.zoneIndex,
                placementType: options?.placementType,
                config
            });
            DividerDebugLogger.warn('ResizeOverlayCase.slotUpdateRejected', 'DividerFacade rejected slot update', {
                traceId,
                cabinetId,
                drawerType,
                key,
                zone,
                zoneIndex: options?.zoneIndex,
                placementType: options?.placementType,
                config,
                runtimeAfterRejectedUpdate: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
            });
            return false;
        }
        DividerDebugLogger.log('ProductConfig._updateDividerSlot', 'Divider overlay refreshed after slot update', {
            traceId,
            cabinetId,
            drawerType,
            zoneIndex: options?.zoneIndex,
            placementType: options?.placementType,
            usedActiveOverlayRestore: wasOverlayActive,
            drawerViewStillActive: Boolean(app.drawerViewService?.isTopViewActive?.()),
            drawerStillOpen: Boolean(app.drawerAnimationService?.isDrawerOpen?.(cabinetId, drawerType))
        });
        DividerDebugLogger.log('ResizeOverlayCase.slotUpdateDone', 'Divider slot update completed', {
            traceId,
            cabinetId,
            drawerType,
            key,
            zone,
            zoneIndex: options?.zoneIndex,
            placementType: options?.placementType,
            config,
            runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
        });
        // Оновлюємо drawer indicator (іконка ✓ якщо є dividers)
        if (app.drawerOverlaySystem) {
            app.drawerOverlaySystem.rescan();
            DividerDebugLogger.log('ProductConfig._updateDividerSlot', 'Drawer overlay indicator rescanned after divider update', {
                traceId,
                cabinetId,
                drawerType
            });
        } else {
            DividerDebugLogger.warn('ProductConfig._updateDividerSlot', 'Drawer overlay system is not available for rescan', {
                traceId,
                cabinetId,
                drawerType
            });
        }
        DividerDebugLogger.log('ProductConfig._updateDividerSlot', 'Divider slot config update completed', {
            traceId,
            cabinetId,
            drawerType,
            key,
            zone,
            zoneIndex: options?.zoneIndex,
            placementType: options?.placementType,
            config
        });
        return true;
    }
}

export { ProductConfigPlugin };
