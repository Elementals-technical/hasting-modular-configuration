export {
  buildConfigurationMetadata,
  type ConfigurationMetadata,
  type ConfigurationUiState,
  type ConfigurationSwatchOrder,
} from "./lib/buildConfigurationMetadata";
export { buildConfigurationShareUrl } from "./lib/buildConfigurationShareUrl";
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
