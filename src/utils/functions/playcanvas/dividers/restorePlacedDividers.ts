const DIVIDER_CONFIG_KEYS = ["TopDrawerDividers", "BotDrawerDividers"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const pickDividerConfigPatch = (config: unknown): Record<string, unknown> => {
  if (!isRecord(config)) return {};

  return DIVIDER_CONFIG_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    if (key in config) {
      acc[key] = config[key];
    }

    return acc;
  }, {});
};
