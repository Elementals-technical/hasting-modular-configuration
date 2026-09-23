export * from "./api";

export { CollectionStateBridge } from "./ui/CollectionStateBridge";

export type {
  AttributeValue,
  CabinetDimensions,
  CabinetEntry,
  ConfigurationSnapshot,
  ConfigurationState,
  DrawerType,
  RestoreFailureReason,
  RestoreState,
  RestoreStatus,
  RuntimeSyncState,
  Scope,
  ScopedValue,
  StableCabinetKey,
  ValueTarget,
} from "./model/types";
export { CONFIGURATION_SNAPSHOT_VERSION, formatTarget, isSameTarget, parseTarget } from "./model/types";

// runtimePort — owned by I: the typed boundary between C and the scene.
export type {
  ConfigurationCompositionPort,
  ConfigurationDividerPort,
  ConfigurationRuntimePort,
  ConfigurationSceneReader,
  ConfigurationSidePanelPort,
  DividerClearResult,
  SceneCompositionPlacement,
  SceneCompositionProduct,
  SceneCompositionReplaceRequest,
  SceneCompositionResult,
  SidePanelApplyResult,
  SidePanelPlacement,
  FailedRuntimeChange,
  RuntimeApplyResult,
  RuntimeChange,
  RuntimeContext,
  RuntimeFailureCode,
  ConfigurationSceneRestorer,
  SceneCabinetState,
  SceneRestoreFailure,
  SceneRestoreIssue,
  SceneRestoreIssueCode,
  SceneRestoreMatch,
  SceneRestoreProduct,
  SceneRestoreRequest,
  SceneRestoreResult,
  SceneStateResult,
  UnsupportedRuntimeChange,
} from "./model/runtimePort";

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
  resolveCabinetDimensions,
  resolveStableKey,
} from "./model/identity";

export {
  clearAttributeValue,
  configurationReducer,
  clearRestore,
  clearRuntimeOutOfSync,
  dropValuesForCabinet,
  failRestore,
  finishRestore,
  markRuntimeOutOfSync,
  recordSceneState,
  requestSceneStateSync,
  startRestore,
  resetConfiguration,
  restoreCabinets,
  restoreConfigurationFragment,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinetOrder,
  syncCabinets,
} from "./model/store/slice";

export {
  getActiveCollectionId,
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getAttributeValue,
  getCabinetByStableKey,
  getCabinetDimensions,
  getCabinetDimensionsByRuntimeId,
  getDimensionsByCabinet,
  getValuesByAttributeId,
  getRestoreState,
  getRuntimeSyncState,
  isRestoreInFlightOrDone,
  getCabinetEntries,
  getConfigurationSnapshot,
  getConfigurationState,
  getStableKeyForRuntimeId,
} from "./model/store/selectors";
