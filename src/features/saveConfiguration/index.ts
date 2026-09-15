export {
  buildConfigurationMetadata,
  type ConfigurationMetadata,
  type ConfigurationUiState,
  type ConfigurationSwatchOrder,
} from "./lib/buildConfigurationMetadata";
export { buildConfigurationShareUrl } from "./lib/buildConfigurationShareUrl";
export {
  CONFIGURATION_FRAGMENT_VERSION,
  buildConfigurationFragment,
  listFragmentAttributeIds,
  readFragmentValue,
  type ConfigurationFragment,
  type SavedCabinet,
  type SavedValuesByTarget,
} from "./lib/configurationFragment";
export {
  readConfigurationFragment,
  readSavedCollectionId,
  type FragmentIssue,
  type FragmentIssueCode,
  type ReadFragmentResult,
} from "./lib/legacyMetadata";
export {
  selectConfigurationFragment,
  selectConfigurationSavePayload,
  selectConfigurationUiState,
  type ConfigurationSavePayload,
} from "./lib/selectSavePayload";
export { useCurrentConfigurationLink, type CurrentConfigurationLink } from "./hooks/useCurrentConfigurationLink";
export {
  hashConfigurationRequest,
  useBuildConfigurationRequest,
  useSaveCurrentConfiguration,
  type BuildConfigurationRequestOptions,
  type ConfigurationSaveRequest,
  type SaveCurrentConfigurationOptions,
  type SaveCurrentConfigurationResult,
} from "./hooks/useSaveCurrentConfiguration";
export { collectSceneConfiguration, type SceneConfiguration } from "./lib/collectSceneConfiguration";
export { RESTORE_INCOMPLETE_SAVE_MESSAGE, isRestoreBlockingSave } from "./lib/restoreSaveGuard";
export {
  COLLECTION_ID_QUERY_PARAM,
  CONFIGURATION_ID_QUERY_PARAM,
  HOST_URL_QUERY_PARAM,
  buildConfigurationRestoreSearch,
  buildPublicConfigurationShareUrl,
  clearPersistedHostUrl,
  persistHostUrlFromSearch,
  readHostUrlFromSearch,
  resolveConfigurationIdFromSearch,
  resolveHostUrl,
} from "./lib/configurationUrlParams";
