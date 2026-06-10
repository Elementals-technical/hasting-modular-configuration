const CONFIGURATION_ID_QUERY_PARAM = "configId";

export type QuoteConfigurationLinkStatus = "idle" | "pending" | "settled";

const normalizeConfigurationId = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized || null;
};

export const resolveQuoteConfigurationIdFromUrl = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  const queryStart = normalized.indexOf("?");
  const hashStart = queryStart >= 0 ? normalized.indexOf("#", queryStart) : -1;
  const queryText =
    queryStart >= 0
      ? normalized.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined)
      : normalized.startsWith(`${CONFIGURATION_ID_QUERY_PARAM}=`)
        ? normalized
        : "";

  if (!queryText) return null;

  return normalizeConfigurationId(new URLSearchParams(queryText).get(CONFIGURATION_ID_QUERY_PARAM));
};

export const resolveQuoteConfigurationId = (search: string, generatedConfigId: string | null): string | null => {
  const configIdFromUrl = resolveQuoteConfigurationIdFromUrl(search);
  const normalizedGeneratedConfigId = generatedConfigId?.trim();
  return configIdFromUrl || normalizedGeneratedConfigId || null;
};
