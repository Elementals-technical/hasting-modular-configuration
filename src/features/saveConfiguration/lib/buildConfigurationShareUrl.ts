import { ROUTES } from "@/shared";
import {
  buildPublicConfigurationShareUrl,
  CONFIGURATION_ID_QUERY_PARAM,
  resolveHostUrl,
} from "./configurationUrlParams";

export const buildConfigurationShareUrl = (configId: string | number): string => {
  const publicShareUrl = buildPublicConfigurationShareUrl(resolveHostUrl(), configId);
  if (publicShareUrl) return publicShareUrl;

  return `${window.location.origin}${ROUTES.RESTORE}?${CONFIGURATION_ID_QUERY_PARAM}=${encodeURIComponent(
    String(configId),
  )}`;
};
