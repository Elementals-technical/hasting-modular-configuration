import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { maxSeqFromKeys, rebindSavedCabinets, reconcileOrder, registerCabinets } from "../identity";
import { isSameTarget } from "../types";
import type {
  AttributeValue,
  CabinetEntry,
  ConfigurationSnapshot,
  ConfigurationState,
  StableCabinetKey,
  ValueTarget,
} from "../types";

/**
 * Holds only what the typed product slice cannot address today: the active collection,
 * stable product identity/order, and values of attributes that have been migrated off
 * the typed core.
 *
 * It deliberately does not mirror `productOptions`. An attributeId lives either in the
 * product slice or in `valuesByAttributeId` — never in both — which is what makes
 * "no two independently mutable copies" testable.
 */

const initialState: ConfigurationState = {
  collectionId: null,
  cabinets: [],
  nextCabinetSeq: 1,
  valuesByAttributeId: {},
};

const configurationSlice = createSlice({
  name: "configuration",
  initialState,
  reducers: {
    /** Set by A once the active collection resolves. */
    setActiveCollectionId(state, action: PayloadAction<string | null>) {
      state.collectionId = action.payload;
    },

    /** Registers the runtime ids currently present in the scene, preserving known keys. */
    syncCabinets(state, action: PayloadAction<string[]>) {
      const { entries, nextSeq } = registerCabinets(state.cabinets, action.payload, state.nextCabinetSeq);
      state.cabinets = entries;
      state.nextCabinetSeq = nextSeq;
    },

    /** Applies the composition order reported by the scene. */
    syncCabinetOrder(state, action: PayloadAction<string[]>) {
      state.cabinets = reconcileOrder(state.cabinets, action.payload);
    },

    /** Restores saved identity by pairing saved keys with freshly created runtime ids. */
    restoreCabinets(state, action: PayloadAction<{ stableKeys: StableCabinetKey[]; runtimeIds: string[] }>) {
      const { stableKeys, runtimeIds } = action.payload;
      state.cabinets = rebindSavedCabinets(stableKeys, runtimeIds);
      state.nextCabinetSeq = Math.max(state.nextCabinetSeq, maxSeqFromKeys(stableKeys) + 1);
    },

    setAttributeValue(
      state,
      action: PayloadAction<{ attributeId: string; target: ValueTarget; value: AttributeValue }>,
    ) {
      const { attributeId, target, value } = action.payload;
      const existing = state.valuesByAttributeId[attributeId] ?? [];
      const index = existing.findIndex((entry) => isSameTarget(entry.target, target));

      if (index === -1) {
        state.valuesByAttributeId[attributeId] = [...existing, { target, value }];
        return;
      }

      state.valuesByAttributeId[attributeId] = existing.map((entry, entryIndex) =>
        entryIndex === index ? { target, value } : entry,
      );
    },

    clearAttributeValue(state, action: PayloadAction<{ attributeId: string; target: ValueTarget }>) {
      const { attributeId, target } = action.payload;
      const existing = state.valuesByAttributeId[attributeId];
      if (!existing) return;

      const next = existing.filter((entry) => !isSameTarget(entry.target, target));

      if (next.length === 0) {
        delete state.valuesByAttributeId[attributeId];
        return;
      }

      state.valuesByAttributeId[attributeId] = next;
    },

    /** Drops every value addressed to a product that no longer exists. */
    dropValuesForCabinet(state, action: PayloadAction<StableCabinetKey>) {
      const cabinetId = action.payload;

      for (const [attributeId, values] of Object.entries(state.valuesByAttributeId)) {
        const next = values.filter(
          (entry) =>
            !((entry.target.scope === "cabinet" || entry.target.scope === "drawer") &&
              entry.target.cabinetId === cabinetId),
        );

        if (next.length === 0) {
          delete state.valuesByAttributeId[attributeId];
          continue;
        }

        state.valuesByAttributeId[attributeId] = next;
      }
    },

    /** Replaces the dynamic fragment from a saved snapshot. Identity is restored separately. */
    restoreConfigurationFragment(state, action: PayloadAction<Pick<ConfigurationSnapshot, "values" | "cabinets">>) {
      const { values, cabinets } = action.payload;
      state.valuesByAttributeId = values;
      state.cabinets = cabinets as CabinetEntry[];
      state.nextCabinetSeq = Math.max(
        state.nextCabinetSeq,
        maxSeqFromKeys(cabinets.map((entry) => entry.stableKey)) + 1,
      );
    },

    resetConfiguration(state) {
      return { ...initialState, collectionId: state.collectionId };
    },
  },
});

export const {
  setActiveCollectionId,
  syncCabinets,
  syncCabinetOrder,
  restoreCabinets,
  setAttributeValue,
  clearAttributeValue,
  dropValuesForCabinet,
  restoreConfigurationFragment,
  resetConfiguration,
} = configurationSlice.actions;

export const configurationReducer = configurationSlice.reducer;
