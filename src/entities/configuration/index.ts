export * from "./api";

export type {
  AttributeValue,
  CabinetEntry,
  ConfigurationSnapshot,
  ConfigurationState,
  DrawerType,
  Scope,
  ScopedValue,
  StableCabinetKey,
  ValueTarget,
} from "./model/types";
export { CONFIGURATION_SNAPSHOT_VERSION, formatTarget, isSameTarget } from "./model/types";

export type { AttributeOwnership, PersistedIn, ValueOwner } from "./model/ownership";
export {
  ATTRIBUTE_OWNERSHIP,
  CORE_ATTRIBUTE_IDS,
  getAttributeOwnership,
  getAttributeScope,
  getUnpersistedAttributeIds,
} from "./model/ownership";

export {
  createStableKey,
  findByRuntimeId,
  findByStableKey,
  maxSeqFromKeys,
  rebindSavedCabinets,
  reconcileOrder,
  registerCabinets,
  resolveStableKey,
} from "./model/identity";

export {
  clearAttributeValue,
  configurationReducer,
  dropValuesForCabinet,
  resetConfiguration,
  restoreCabinets,
  restoreConfigurationFragment,
  setActiveCollectionId,
  setAttributeValue,
  syncCabinetOrder,
  syncCabinets,
} from "./model/store/slice";

export {
  getActiveCollectionId,
  getActiveProductProfile,
  getAttributeValue,
  getCabinetByStableKey,
  getCabinetEntries,
  getConfigurationSnapshot,
  getConfigurationState,
  getStableKeyForRuntimeId,
} from "./model/store/selectors";
