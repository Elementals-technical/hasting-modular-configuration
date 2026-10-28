import { LoggerService } from '../../services/logger/logger-service.mjs';
import { DividerFacade } from '../../services/drawer-divider/DividerFacade.mjs';
import { DividerDebugLogger } from '../../services/drawer-divider/diagnostics/DividerDebugLogger.mjs';

/**
 * Divider Plugin для ConfiguratorAPI.
 *
 * Інкапсулює методи управління дівайдерами в шухлядах.
 * Методи доступні через ConfiguratorAPI.dividers.*
 */ class DividerPlugin {
    /**
   * @param {boolean|{show?: boolean, selectedDividerType?: string|null, debugRequestId?: string}|null|undefined} showOrOptions
   */ static _normalizeShowIconDividerSlotsOptions(showOrOptions = true) {
        if (typeof showOrOptions === 'boolean') {
            return {
                show: showOrOptions,
                selectedDividerType: null,
                usePlacementCandidates: false,
                debugRequestId: null
            };
        }
        if (showOrOptions && typeof showOrOptions === 'object') {
            const hasSelectedDividerType = Object.prototype.hasOwnProperty.call(showOrOptions, 'selectedDividerType');
            return {
                show: showOrOptions.show !== false,
                selectedDividerType: showOrOptions.selectedDividerType || null,
                usePlacementCandidates: hasSelectedDividerType,
                debugRequestId: showOrOptions.debugRequestId || null
            };
        }
        return {
            show: true,
            selectedDividerType: null,
            usePlacementCandidates: false,
            debugRequestId: null
        };
    }
    /**
   * @param {{ app: object, bridge: object }} ctx
   * @returns {object} Namespace об'єкт для ConfiguratorAPI.dividers
   */ static create(ctx) {
        const { app, bridge } = ctx;
        return {
            /**
       * Показати/сховати іконки слотів дівайдерів
       * @param {string} cabinetId
       * @param {string} drawerType
       * @param {boolean|{show?: boolean, selectedDividerType?: string|null, debugRequestId?: string}} [showOrOptions=true]
       */ showIconDividerSlots: (cabinetId, drawerType, showOrOptions = true)=>{
                const traceId = DividerDebugLogger.nextTraceId('divider-overlay');
                const normalizedOptions = DividerPlugin._normalizeShowIconDividerSlotsOptions(showOrOptions);
                const effectiveDebugRequestId = normalizedOptions.debugRequestId || traceId;
                DividerDebugLogger.log('API.showIconDividerSlots', 'Request received', {
                    traceId,
                    cabinetId,
                    drawerType,
                    rawOptions: showOrOptions,
                    normalizedOptions
                });
                DividerDebugLogger.log('ResizeOverlayCase.apiShowIconDividerSlotsStart', 'showIconDividerSlots called for resize overlay debugging', {
                    traceId,
                    cabinetId,
                    drawerType,
                    rawOptions: showOrOptions,
                    normalizedOptions,
                    runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
                });
                if (!app.dividerSlotOverlaySystem) {
                    DividerDebugLogger.error('API.showIconDividerSlots', 'DividerSlotOverlaySystem is not initialized', {
                        traceId,
                        cabinetId,
                        drawerType,
                        rawOptions: showOrOptions,
                        normalizedOptions
                    });
                    return false;
                }
                if (normalizedOptions.show) {
                    app.dividerSlotOverlaySystem.activateDrawer(cabinetId, drawerType, {
                        selectedDividerType: normalizedOptions.selectedDividerType,
                        usePlacementCandidates: normalizedOptions.usePlacementCandidates,
                        debugRequestId: effectiveDebugRequestId
                    });
                } else {
                    app.dividerSlotOverlaySystem.deactivate();
                }
                DividerDebugLogger.log('API.showIconDividerSlots', 'Request completed', {
                    traceId,
                    active: Boolean(normalizedOptions.show),
                    selectedDividerType: normalizedOptions.selectedDividerType,
                    usePlacementCandidates: normalizedOptions.usePlacementCandidates,
                    debugRequestId: effectiveDebugRequestId
                });
                DividerDebugLogger.log('ResizeOverlayCase.apiShowIconDividerSlotsDone', 'showIconDividerSlots completed for resize overlay debugging', {
                    traceId,
                    cabinetId,
                    drawerType,
                    active: Boolean(normalizedOptions.show),
                    selectedDividerType: normalizedOptions.selectedDividerType,
                    usePlacementCandidates: normalizedOptions.usePlacementCandidates,
                    debugRequestId: effectiveDebugRequestId,
                    runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
                });
            },
            /**
       * Отримати доступні типи дівайдерів для слота
       * @param {object} options - { cabinetId, drawerType, zone, slotKey }
       * @returns {string[]}
       */ getAvailableDividerTypes: (options)=>{
                const traceId = DividerDebugLogger.nextTraceId('divider-available');
                if (!DividerFacade.instance) {
                    DividerDebugLogger.warn('API.getAvailableDividerTypes', 'DividerFacade is not initialized', {
                        traceId,
                        options
                    });
                    return [];
                }
                const slotData = DividerFacade.instance.getDividerValue(options.cabinetId, options.drawerType, options.zone, options.slotKey);
                const availableTypes = slotData?.other?.availableTypes || [];
                DividerDebugLogger.log('API.getAvailableDividerTypes', 'Resolved slot availability', {
                    traceId,
                    options,
                    availableTypes,
                    slot: DividerDebugLogger.summarizeSlots(slotData ? [
                        slotData
                    ] : [])
                });
                return availableTypes;
            },
            /**
       * Отримати значення дівайдера
       * @param {string} cabinetId
       * @param {string} drawerType
       * @param {string} zone
       * @param {string} key
       * @returns {object|null}
       */ getValueDivider: (cabinetId, drawerType, zone, key)=>{
                if (!DividerFacade.instance) {
                    DividerDebugLogger.warn('API.getValueDivider', 'DividerFacade is not initialized', {
                        cabinetId,
                        drawerType,
                        zone,
                        key
                    });
                    return null;
                }
                const value = DividerFacade.instance.getDividerValue(cabinetId, drawerType, zone, key);
                DividerDebugLogger.log('API.getValueDivider', 'Resolved divider slot value', {
                    cabinetId,
                    drawerType,
                    zone,
                    key,
                    slot: DividerDebugLogger.summarizeSlots(value ? [
                        value
                    ] : [])
                });
                return value;
            },
            /**
       * Розмістити дівайдер у слот
       * @param {object} options - { cabinetId, drawerType, key, zone, zoneIndex, placementType, availableTypes, canPlace, disabledReason }
       * @param {string} typeDivider - Тип дівайдера
       */ placeDividerToSlot: async (options, typeDivider)=>{
                const { cabinetId, drawerType, key, zone, zoneIndex, start, anchor, placementType, availableTypes, canPlace, disabledReason } = options;
                const traceId = options?.debugRequestId || DividerDebugLogger.nextTraceId('divider-place');
                DividerDebugLogger.log('API.placeDividerToSlot', 'Placement request started', {
                    traceId,
                    options: {
                        ...options,
                        zoneIndex,
                        placementType,
                        availableTypes,
                        canPlace,
                        disabledReason
                    },
                    typeDivider
                });
                DividerDebugLogger.log('ResizeOverlayCase.placeDividerStart', 'Divider placement request started', {
                    traceId,
                    cabinetId,
                    drawerType,
                    key,
                    zone,
                    zoneIndex,
                    placementType,
                    availableTypes,
                    canPlace,
                    disabledReason,
                    typeDivider,
                    runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
                });
                try {
                    if (canPlace === false) {
                        DividerDebugLogger.warn('API.placeDividerToSlot', 'Placement rejected because candidate is disabled', {
                            traceId,
                            cabinetId,
                            drawerType,
                            key,
                            zone,
                            zoneIndex,
                            placementType,
                            availableTypes,
                            disabledReason,
                            typeDivider
                        });
                        return false;
                    }
                    if (!window.ConfiguratorAPI?.setConfigBatch) {
                        throw new Error('ConfiguratorAPI.setConfigBatch is not available');
                    }
                    const result = await window.ConfiguratorAPI.setConfigBatch({
                        cabinetId,
                        drawerType,
                        key,
                        zone,
                        zoneIndex,
                        start: start ?? options.slot?.other?.start,
                        anchor: anchor ?? options.slot?.other?.anchor,
                        placementType: placementType || typeDivider,
                        availableTypes,
                        canPlace,
                        disabledReason
                    }, {
                        value: typeDivider
                    });
                    DividerDebugLogger.log('API.placeDividerToSlot', 'Placement request completed', {
                        traceId,
                        zoneIndex,
                        placementType: placementType || typeDivider,
                        availableTypes,
                        canPlace,
                        disabledReason,
                        result
                    });
                    DividerDebugLogger.log('ResizeOverlayCase.placeDividerDone', 'Divider placement request completed', {
                        traceId,
                        cabinetId,
                        drawerType,
                        key,
                        zone,
                        zoneIndex,
                        placementType: placementType || typeDivider,
                        result,
                        runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
                    });
                    return result;
                } catch (error) {
                    DividerDebugLogger.error('API.placeDividerToSlot', 'Placement request failed', {
                        traceId,
                        options,
                        typeDivider,
                        error
                    });
                    throw error;
                }
            },
            /**
       * Видалити дівайдер зі слота
       * @param {object} options - { cabinetId, drawerType, key, zone, zoneIndex }
       */ removeDividerFromSlot: async (options)=>{
                const { cabinetId, drawerType, key, zone, zoneIndex, placementType, stateId, dividerType } = options;
                const traceId = options?.debugRequestId || DividerDebugLogger.nextTraceId('divider-remove');
                DividerDebugLogger.log('API.removeDividerFromSlot', 'Remove request started', {
                    traceId,
                    options: {
                        ...options,
                        zoneIndex,
                        placementType,
                        stateId,
                        dividerType
                    }
                });
                DividerDebugLogger.log('ResizeOverlayCase.removeDividerStart', 'Divider remove request started', {
                    traceId,
                    cabinetId,
                    drawerType,
                    key,
                    zone,
                    zoneIndex,
                    placementType,
                    stateId,
                    dividerType,
                    runtimeBefore: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
                });
                try {
                    if (!window.ConfiguratorAPI?.setConfigBatch) {
                        throw new Error('ConfiguratorAPI.setConfigBatch is not available');
                    }
                    const result = await window.ConfiguratorAPI.setConfigBatch({
                        cabinetId,
                        drawerType,
                        key,
                        zone,
                        zoneIndex,
                        placementType,
                        stateId,
                        dividerType,
                        debugRequestId: traceId
                    }, {
                        value: 'empty'
                    });
                    DividerDebugLogger.log('API.removeDividerFromSlot', 'Remove request completed', {
                        traceId,
                        zoneIndex,
                        placementType,
                        stateId,
                        dividerType,
                        result
                    });
                    DividerDebugLogger.log('ResizeOverlayCase.removeDividerDone', 'Divider remove request completed', {
                        traceId,
                        cabinetId,
                        drawerType,
                        key,
                        zone,
                        zoneIndex,
                        placementType,
                        stateId,
                        dividerType,
                        result,
                        runtimeAfter: DividerDebugLogger.summarizeDrawerRuntime(app, cabinetId, drawerType)
                    });
                    return result;
                } catch (error) {
                    DividerDebugLogger.error('API.removeDividerFromSlot', 'Remove request failed', {
                        traceId,
                        options,
                        error
                    });
                    throw error;
                }
            },
            /**
       * Enable or disable extended divider diagnostics.
       * @param {boolean} enabled
       * @param {{ persist?: boolean }} [options]
       */ setDebugLogging: (enabled, options = {})=>{
                return DividerDebugLogger.setEnabled(enabled, options);
            },
            /**
       * @returns {boolean}
       */ getDebugLogging: ()=>{
                return DividerDebugLogger.isEnabled();
            },
            /**
       * Dump recent divider diagnostics from PlayCanvas, including SlotEngine.
       * @param {{ limit?: number, level?: string, stageIncludes?: string }} [options]
       * @returns {object}
       */ getDebugEvents: (options = {})=>{
                return DividerDebugLogger.dump(options);
            },
            /**
       * Clear the PlayCanvas-side divider diagnostics buffer.
       * @returns {boolean}
       */ clearDebugEvents: ()=>{
                DividerDebugLogger.clearEvents();
                return true;
            },
            /**
       * Set max retained PlayCanvas-side divider diagnostics events.
       * @param {number} maxEvents
       * @returns {number}
       */ setDebugMaxEvents: (maxEvents)=>{
                return DividerDebugLogger.setMaxEvents(maxEvents);
            },
            /**
       * Snapshot all cabinet divider states in the active composition.
       * @returns {object|null}
       */ getDebugSnapshot: ()=>{
                const snapshot = DividerFacade.instance?.getDebugSnapshot?.() || null;
                DividerDebugLogger.log('API.getDebugSnapshot', 'Snapshot requested', snapshot);
                return snapshot;
            },
            /**
       * Встановити обробник кліку на ghost слот
       * @param {Function} callback - (slotInfo) => void
       * @returns {boolean}
       */ setOnAddSlotClick: (callback)=>{
                if (!app.dividerSlotOverlaySystem) {
                    LoggerService.error(bridge, '[Bridge] DividerSlotOverlaySystem not initialized');
                    return false;
                }
                app.dividerSlotOverlaySystem.setOnAddSlotClick(callback);
                LoggerService.log(bridge, '[Bridge] Divider add slot click handler set');
                DividerDebugLogger.log('API.setOnAddSlotClick', 'Handler registered', {
                    hasCallback: typeof callback === 'function'
                });
                return true;
            },
            /**
       * Встановити обробник кліку на occupied слот
       * @param {Function} callback - (slotInfo) => void
       * @returns {boolean}
       */ setOnOccupiedSlotClick: (callback)=>{
                if (!app.dividerSlotOverlaySystem) {
                    LoggerService.error(bridge, '[Bridge] DividerSlotOverlaySystem not initialized');
                    return false;
                }
                app.dividerSlotOverlaySystem.setOnOccupiedSlotClick(callback);
                LoggerService.log(bridge, '[Bridge] Divider occupied slot click handler set');
                DividerDebugLogger.log('API.setOnOccupiedSlotClick', 'Handler registered', {
                    hasCallback: typeof callback === 'function'
                });
                return true;
            },
            /**
       * Встановити обробник кліку на слот дівайдера
       * @param {Function} callback - (slotInfo) => void
       * @returns {boolean}
       */ setDividerSlotClickHandler: (callback)=>{
                if (!app.dividerSlotOverlaySystem) {
                    LoggerService.error(bridge, '[Bridge] DividerSlotOverlaySystem not initialized');
                    return false;
                }
                app.dividerSlotOverlaySystem.setOnSlotClick(callback);
                LoggerService.log(bridge, '[Bridge] Divider slot click handler set');
                DividerDebugLogger.log('API.setDividerSlotClickHandler', 'Legacy handler registered', {
                    hasCallback: typeof callback === 'function'
                });
                return true;
            },
            /**
       * Тестовий метод — встановлює click handler що додає дівайдер до кліканого слоту
       * @param {string} [type='A'] - Тип дівайдера для додавання
       * @example
       * ConfiguratorAPI.dividers.setTestClickHandler();
       * ConfiguratorAPI.dividers.setTestClickHandler('B');
       */ setTestClickHandler: (type)=>{
                window.ConfiguratorAPI.dividers.setDividerSlotClickHandler((slotInfo)=>{
                    LoggerService.log(bridge, '[Bridge] Test click - slot info:', slotInfo);
                    window.ConfiguratorAPI.dividers.placeDividerToSlot({
                        cabinetId: slotInfo.cabinetId,
                        drawerType: slotInfo.drawerType,
                        key: slotInfo.key,
                        zone: slotInfo.zone,
                        zoneIndex: slotInfo.zoneIndex,
                        placementType: slotInfo.placementType || type || 'A',
                        availableTypes: slotInfo.availableTypes,
                        canPlace: slotInfo.canPlace,
                        disabledReason: slotInfo.disabledReason
                    }, type || 'A');
                });
            }
        };
    }
}

export { DividerPlugin };
