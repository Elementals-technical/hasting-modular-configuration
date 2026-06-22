import { ROUTES } from "@/shared";
import {
  buildPublicConfigurationShareUrl,
  CONFIGURATION_ID_QUERY_PARAM,
  resolveHostUrl,
} from "./configurationUrlParams";

const RESTORE_PATH = {
  prebuilt: `${ROUTES.PREBUILT}/model`,
  custom: `${ROUTES.CUSTOM}/cabinet-builder`,
} as const;

/**
 * Restore links are flow-specific: prebuilt configurations restore on the prebuilt
 * model page (ModelPage), custom ones on the cabinet builder (CabinetBuilderPage).
 * The flow is derived from the path the configuration was saved on, so a config
 * built in prebuilt opens its own restore page instead of being handed off.
 */
export const buildConfigurationShareUrl = (configId: string | number, sourcePath: string): string => {
  const publicShareUrl = buildPublicConfigurationShareUrl(resolveHostUrl(), configId);
  if (publicShareUrl) return publicShareUrl;

  const restorePath = sourcePath.startsWith(ROUTES.PREBUILT) ? RESTORE_PATH.prebuilt : RESTORE_PATH.custom;
  return `${window.location.origin}${restorePath}?${CONFIGURATION_ID_QUERY_PARAM}=${encodeURIComponent(
    String(configId),
  )}`;
};
