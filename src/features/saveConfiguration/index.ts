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
  CONFIGURATION_ID_QUERY_PARAM,
  HOST_URL_QUERY_PARAM,
  buildPublicConfigurationShareUrl,
  clearPersistedHostUrl,
  persistHostUrlFromSearch,
  readHostUrlFromSearch,
  resolveConfigurationIdFromSearch,
  resolveHostUrl,
} from "./lib/configurationUrlParams";
