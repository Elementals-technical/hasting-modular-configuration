import { DividerCalculator } from '../core/DividerCalculator.mjs';
import { DividerDefinitions } from '../core/DividerDefinitions.mjs';
import { DividerPlacementCandidateEngine } from '../core/DividerPlacementCandidateEngine.mjs';
import { DividerDebugLogger } from '../diagnostics/DividerDebugLogger.mjs';

// @ts-check
/**
 * Адаптер для інтеграції divider системи з CompositionManager
 * Відповідає за отримання та збереження dividers в store
 */ class DividerCompositionAdapter {
    getDividerValue(cabinetId, drawerType, zoneName, key) {
        const composition = this.compositionManager.getActiveComposition();
        if (!composition) {
            DividerDebugLogger.warn('Adapter.getDividerValue', 'No active composition', {
                cabinetId,
                drawerType,
                zoneName,
                key
            });
            return null;
        }
        const productConfig = composition.getProduct(cabinetId);
        if (!productConfig) {
            DividerDebugLogger.warn('Adapter.getDividerValue', 'Product not found', {
                cabinetId,
                drawerType,
                zoneName,
                key
            });
            return null;
        }
        const configKey = DividerDefinitions.getNodeDrawerDefinition(drawerType);
        const drawerConfig = productConfig[configKey];
        if (!drawerConfig) {
            DividerDebugLogger.warn('Adapter.getDividerValue', 'Drawer divider config not found', {
                cabinetId,
                drawerType,
                configKey,
                product: DividerDebugLogger.summarizeProduct(cabinetId, productConfig)
            });
            return null;
        }
        const zoneData = drawerConfig?.zones?.[zoneName];
        const slotData = zoneData?.slots?.find((slot)=>slot.key === key);
        DividerDebugLogger.log('Adapter.getDividerValue', 'Resolved slot from composition state', {
            cabinetId,
            drawerType,
            configKey,
            zoneName,
            key,
            slot: DividerDebugLogger.summarizeSlots(slotData ? [
                slotData
            ] : [])
        });
        return slotData;
    }
    /**
     * Отримує поточний стан dividers з composition store
     * @param {string} cabinetId - ID тумби
     * @param {string} drawerType - Тип шухляди ('Top' або 'Bot')
     * @returns {Object|null} Стан dividers або null, якщо не знайдено
     */ getDividersState(cabinetId, drawerType) {
        const composition = this.compositionManager.getActiveComposition();
        if (!composition) {
            DividerDebugLogger.warn('Adapter.getDividersState', 'No active composition', {
                cabinetId,
                drawerType
            });
            return null;
        }
        const productConfig = composition.getProduct(cabinetId);
        if (!productConfig) {
            DividerDebugLogger.warn('Adapter.getDividersState', 'Product not found', {
                cabinetId,
                drawerType
            });
            return null;
        }
        const configKey = DividerDefinitions.getNodeDrawerDefinition(drawerType);
        const drawerConfig = productConfig[configKey];
        if (!drawerConfig) {
            DividerDebugLogger.warn('Adapter.getDividersState', 'Drawer divider config not found', {
                cabinetId,
                drawerType,
                configKey,
                product: DividerDebugLogger.summarizeProduct(cabinetId, productConfig)
            });
            return null;
        }
        DividerDebugLogger.log('Adapter.getDividersState', 'Resolved drawer divider state', {
            cabinetId,
            drawerType,
            configKey,
            state: DividerDebugLogger.summarizeDrawerConfig(drawerConfig)
        });
        return drawerConfig;
    }
    getDividersCompareState(cabinetId, drawerType) {
        const dividersState = this.getDividersState(cabinetId, drawerType);
        const compactState = this.getCompactState(dividersState);
        DividerDebugLogger.log('Adapter.getDividersCompareState', 'Converted full state to compact occupied state', {
            cabinetId,
            drawerType,
            fullState: DividerDebugLogger.summarizeDrawerConfig(dividersState),
            compactState: DividerDebugLogger.summarizeCompactState(compactState)
        });
        return compactState;
    }
    /**
     * Отримує компактний стан (тільки occupied slots) з повного стану
     * @param {Object} fullState - Повний стан з zones та slots
     * @returns {Object} Компактний стан { zones: { zoneName: { slots: [...] } } }
     */ getCompactState(fullState) {
        if (!fullState?.zones) {
            DividerDebugLogger.log('Adapter.getCompactState', 'Full divider state has no zones', {
                fullState
            });
            return {
                zones: {}
            };
        }
        const compactZones = {};
        Object.keys(fullState.zones).forEach((zoneName)=>{
            const zoneData = fullState.zones[zoneName];
            if (!zoneData?.slots || !Array.isArray(zoneData.slots)) {
                return;
            }
            // Фільтруємо тільки occupied slots (не ghost)
            const occupiedSlots = zoneData.slots.filter((slot)=>slot.value !== 'empty' && slot.value !== 'none' && (slot.other?.type === 'occupied' || !slot.other?.type)).map((slot)=>({
                    key: slot.key,
                    value: slot.value,
                    stateId: slot.other?.stateId || slot.stateId,
                    zoneIndex: slot.other?.zoneIndex ?? slot.zoneIndex ?? 0,
                    start: slot.other?.start ?? slot.start,
                    anchor: slot.other?.anchor ?? slot.anchor
                }));
            if (occupiedSlots.length > 0) {
                compactZones[zoneName] = {
                    slots: occupiedSlots
                };
            }
        });
        const compactState = {
            zones: compactZones
        };
        DividerDebugLogger.log('Adapter.getCompactState', 'Compact divider state built', {
            compactState: DividerDebugLogger.summarizeCompactState(compactState)
        });
        return compactState;
    }
    showIconDividerSlots(cabinetId, drawerType, app) {
        const composition = this.compositionManager.getActiveComposition();
        if (!composition) {
            DividerDebugLogger.warn('Adapter.showIconDividerSlots', 'No active composition for overlay slots', {
                cabinetId,
                drawerType
            });
            return [];
        }
        const config = composition.getProduct(cabinetId);
        if (!config) {
            DividerDebugLogger.warn('Adapter.showIconDividerSlots', 'Product config not found for overlay slots', {
                cabinetId,
                drawerType
            });
            return [];
        }
        const width = config.Width || 60;
        const configType = DividerDefinitions.getConfigType(drawerType);
        const dataValueDravwer = this.getDividersCompareState(cabinetId, drawerType);
        const calculator = new DividerCalculator();
        const result = calculator.getAllPotentialSlots(width, configType, dataValueDravwer);
        // Інлайн getSlotConvertList — збираємо всі слоти з усіх зон
        const zones = result?.zones;
        if (!zones || Object.keys(zones).length === 0) {
            DividerDebugLogger.warn('Adapter.showIconDividerSlots', 'No zones returned for overlay slots', {
                cabinetId,
                drawerType,
                width,
                configType,
                result
            });
            return [];
        }
        const allSlots = Object.values(zones).flatMap((zone)=>zone.slots || []);
        const sortedSlots = allSlots.sort((a, b)=>a.position.start - b.position.start);
        DividerDebugLogger.log('Adapter.showIconDividerSlots', 'Overlay slots resolved from composition', {
            cabinetId,
            drawerType,
            width,
            configType,
            compactState: DividerDebugLogger.summarizeCompactState(dataValueDravwer),
            slots: DividerDebugLogger.summarizeSlots(sortedSlots)
        });
        return sortedSlots;
    }
    showPlacementCandidateSlots(cabinetId, drawerType, app, selectedDividerType = null, debugRequestId = null) {
        const composition = this.compositionManager.getActiveComposition();
        if (!composition) {
            DividerDebugLogger.warn('Adapter.showPlacementCandidateSlots', 'No active composition for placement candidates', {
                traceId: debugRequestId,
                cabinetId,
                drawerType,
                selectedDividerType
            });
            return [];
        }
        const config = composition.getProduct(cabinetId);
        if (!config) {
            DividerDebugLogger.warn('Adapter.showPlacementCandidateSlots', 'Product config not found for placement candidates', {
                traceId: debugRequestId,
                cabinetId,
                drawerType,
                selectedDividerType
            });
            return [];
        }
        const width = config.Width || 60;
        const compactState = this.getDividersCompareState(cabinetId, drawerType);
        const result = this.placementCandidateEngine.getPlacementSlots(width, drawerType, compactState, selectedDividerType, debugRequestId);
        const zones = result?.zones;
        if (!zones || Object.keys(zones).length === 0) {
            DividerDebugLogger.warn('Adapter.showPlacementCandidateSlots', 'No zones returned for placement candidates', {
                traceId: debugRequestId,
                cabinetId,
                drawerType,
                width,
                selectedDividerType,
                result
            });
            return [];
        }
        const allSlots = Object.values(zones).flatMap((zone)=>zone.slots || []);
        const sortedSlots = allSlots.sort((a, b)=>a.position.start - b.position.start);
        DividerDebugLogger.log('Adapter.showPlacementCandidateSlots', 'Placement candidates resolved from composition', {
            traceId: debugRequestId,
            cabinetId,
            drawerType,
            width,
            selectedDividerType,
            compactState: DividerDebugLogger.summarizeCompactState(compactState),
            slots: DividerDebugLogger.summarizeSlots(sortedSlots)
        });
        return sortedSlots;
    }
    constructor(compositionManager){
        this.compositionManager = compositionManager;
        this.placementCandidateEngine = new DividerPlacementCandidateEngine();
    }
}

export { DividerCompositionAdapter };
