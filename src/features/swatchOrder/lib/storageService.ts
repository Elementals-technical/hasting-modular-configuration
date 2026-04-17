import type { AttributeValue } from "../model/types";
import { STORAGE_EXPIRY_MS, STORAGE_KEY } from "../model/constants";

interface StoredPayload {
  selectedMaterials: AttributeValue[];
  manualSelectedMaterials: AttributeValue[];
  isAutofillEnabled: boolean;
  hasSubmittedCart: boolean;
}

interface StoredEnvelope {
  data: StoredPayload;
  timestamp: number;
}

const EMPTY: StoredPayload = {
  selectedMaterials: [],
  manualSelectedMaterials: [],
  isAutofillEnabled: true,
  hasSubmittedCart: false,
};

export const StorageService = {
  setState(payload: StoredPayload): void {
    try {
      const stored: StoredEnvelope = { data: payload, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (error) {
      console.warn("swatchOrder: failed to persist state", error);
    }
  },

  getState(): StoredPayload {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY;
      const stored: StoredEnvelope = JSON.parse(raw);
      const isExpired = Date.now() - stored.timestamp > STORAGE_EXPIRY_MS;
      if (isExpired) {
        localStorage.removeItem(STORAGE_KEY);
        return EMPTY;
      }
      const data = stored.data ?? EMPTY;
      return {
        selectedMaterials: Array.isArray(data.selectedMaterials) ? data.selectedMaterials : [],
        manualSelectedMaterials: Array.isArray(data.manualSelectedMaterials) ? data.manualSelectedMaterials : [],
        isAutofillEnabled: Boolean(data.isAutofillEnabled),
        hasSubmittedCart: Boolean(data.hasSubmittedCart),
      };
    } catch (error) {
      console.warn("swatchOrder: failed to read state", error);
      return EMPTY;
    }
  },

};
