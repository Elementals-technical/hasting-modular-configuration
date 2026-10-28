import { DividerDefinitions } from '../core/DividerDefinitions.mjs';

class DividerQueryService {
    /**
     * Знаходить слот дівайдера за ключем
     */ static findSlotInComposition(compositionManager, cabinetId, drawerType, zone, slotKey) {
        const composition = compositionManager.getActiveComposition();
        if (!composition) return null;
        const productConfig = composition.getProduct(cabinetId);
        if (!productConfig) return null;
        const configKey = DividerDefinitions.getNodeDrawerDefinition(drawerType);
        const drawerConfig = productConfig[configKey];
        if (!drawerConfig?.zones?.[zone]) return null;
        const slots = drawerConfig.zones[zone].slots;
        const slotIndex = this._findSlotIndex(slots, slotKey);
        if (slotIndex === -1) return null;
        return {
            slot: slots[slotIndex],
            slotIndex,
            drawerConfig,
            slots,
            zone,
            configKey,
            productConfig
        };
    }
    static _findSlotIndex(slots, slotKey) {
        return slots.findIndex((slot)=>{
            if (typeof slot === 'object' && slot.key === slotKey) return true;
            return false;
        });
    }
}

export { DividerQueryService };
