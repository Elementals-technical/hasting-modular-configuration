import type { RootState } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";

import { findByStableKey, resolveCabinetDimensions, resolveStableKey } from "../identity";
import { CONFIGURATION_SNAPSHOT_VERSION, isSameTarget } from "../types";
import type {
  AttributeValue,
  CabinetDimensions,
  CabinetEntry,
  ConfigurationSnapshot,
  ConfigurationState,
  RestoreState,
  ValueTarget,
} from "../types";

export const getConfigurationState = (state: RootState) => state.rootStateUI.configuration;

export const getRestoreState = (state: RootState): RestoreState => state.rootStateUI.configuration.restore;

export const getRuntimeSyncState = (state: RootState): ConfigurationState["runtimeSync"] =>
  state.rootStateUI.configuration.runtimeSync;

/** Whether this configuration is being restored or already came back, so it must not start again. */
export const isRestoreInFlightOrDone = (state: RootState, configId: string): boolean => {
  const { configId: restoringId, status } = getRestoreState(state);
  return restoringId === configId && (status === "restoring" || status === "restored" || status === "partial");
};

export const getActiveCollectionId = (state: RootState): string | null =>
  state.rootStateUI.configuration.collectionId;

export const getActiveRuntimeBindings = (state: RootState): ConfigurationState["runtimeBindings"] =>
  state.rootStateUI.configuration.runtimeBindings;

export const getCabinetEntries = (state: RootState): CabinetEntry[] => state.rootStateUI.configuration.cabinets;

export const getCabinetByStableKey = (state: RootState, stableKey: string): CabinetEntry | null =>
  findByStableKey(getCabinetEntries(state), stableKey);

export const getStableKeyForRuntimeId = (state: RootState, runtimeId: string): string | null =>
  resolveStableKey(getCabinetEntries(state), runtimeId);

/** Every value by attribute and address. The reference changes only when a value does. */
export const getValuesByAttributeId = (state: RootState): ConfigurationState["valuesByAttributeId"] =>
  state.rootStateUI.configuration.valuesByAttributeId;

/** Actual sizes read from the scene, by stable key. The reference changes only when a size does. */
export const getDimensionsByCabinet = (state: RootState): ConfigurationState["dimensionsByCabinet"] =>
  state.rootStateUI.configuration.dimensionsByCabinet;

/** The actual size of one product as last read from the scene, or null before the first read. */
export const getCabinetDimensions = (state: RootState, stableKey: string): CabinetDimensions | null =>
  getDimensionsByCabinet(state)[stableKey] ?? null;

export const getCabinetDimensionsByRuntimeId = (state: RootState, runtimeId: string): CabinetDimensions | null =>
  resolveCabinetDimensions(getCabinetEntries(state), getDimensionsByCabinet(state), runtimeId);

export const getAttributeValue = (
  state: RootState,
  attributeId: string,
  target: ValueTarget,
): AttributeValue | undefined =>
  state.rootStateUI.configuration.valuesByAttributeId[attributeId]?.find((entry) =>
    isSameTarget(entry.target, target),
  )?.value;

/**
 * The active ProductProfile.
 *
 * Transitional location: it is stored in the product slice next to `cabinetCatalog`
 * because rule evaluation still runs inside product-slice reducers, which cannot read
 * another slice. When C06 moves evaluation into the command layer this moves with it.
 * Consumers read it through this selector so the physical location stays replaceable.
 */
export const getActiveProductProfile = (state: RootState): ProductProfile | null =>
  state.rootStateUI.product.activeProfile;

/**
 * One serialized form shared by Save/Share, history and the price consumer.
 * Reads from the current owners; it does not keep a copy of its own.
 */
export const getConfigurationSnapshot = (state: RootState): ConfigurationSnapshot => ({
  collectionId: getActiveCollectionId(state),
  version: CONFIGURATION_SNAPSHOT_VERSION,
  cabinets: getCabinetEntries(state).map((entry) => ({ ...entry })),
  values: Object.fromEntries(
    Object.entries(state.rootStateUI.configuration.valuesByAttributeId).map(([attributeId, values]) => [
      attributeId,
      values.map((entry) => ({ ...entry })),
    ]),
  ),
});
