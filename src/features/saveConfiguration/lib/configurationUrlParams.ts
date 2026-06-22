export const HOST_URL_QUERY_PARAM = "hostUrl";
export const CONFIGURATION_ID_QUERY_PARAM = "configId";

const HOST_URL_STORAGE_KEY = "hastingsModularConfiguratorHostUrl";

const normalizeQueryValue = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized || null;
};

const toSearchParams = (search: string): URLSearchParams => {
  if (!search) return new URLSearchParams();
  return new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
};

const canUseSessionStorage = (): boolean => {
  try {
    return typeof window !== "undefined" && Boolean(window.sessionStorage);
  } catch {
    return false;
  }
};

export const readHostUrlFromSearch = (search = window.location.search): string | null => {
  return normalizeQueryValue(toSearchParams(search).get(HOST_URL_QUERY_PARAM));
};

export const persistHostUrlFromSearch = (search = window.location.search): string | null => {
  const hostUrl = readHostUrlFromSearch(search);
  if (!hostUrl || !canUseSessionStorage()) return hostUrl;

  window.sessionStorage.setItem(HOST_URL_STORAGE_KEY, hostUrl);
  return hostUrl;
};

export const getPersistedHostUrl = (): string | null => {
  if (!canUseSessionStorage()) return null;
  return normalizeQueryValue(window.sessionStorage.getItem(HOST_URL_STORAGE_KEY));
};

export const clearPersistedHostUrl = () => {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(HOST_URL_STORAGE_KEY);
};

export const resolveHostUrl = (search = window.location.search): string | null => {
  return readHostUrlFromSearch(search) || getPersistedHostUrl();
};

export const resolveConfigurationIdFromSearch = (search = window.location.search): string | null => {
  const params = toSearchParams(search);
  return normalizeQueryValue(params.get(CONFIGURATION_ID_QUERY_PARAM));
};

export const buildPublicConfigurationShareUrl = (
  hostUrl: string | null | undefined,
  configurationId: string | number,
): string | null => {
  const normalizedHostUrl = normalizeQueryValue(hostUrl);
  const normalizedConfigurationId = normalizeQueryValue(String(configurationId));
  if (!normalizedHostUrl || !normalizedConfigurationId) return null;

  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    const url = baseUrl ? new URL(normalizedHostUrl, baseUrl) : new URL(normalizedHostUrl);
    url.searchParams.set(CONFIGURATION_ID_QUERY_PARAM, normalizedConfigurationId);
    return url.toString();
  } catch {
    return null;
  }
};
