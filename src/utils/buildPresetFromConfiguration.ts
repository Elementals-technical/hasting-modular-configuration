import type { PresetProduct } from "@/entities/product/types";

type ConfigurationMap = Record<string, Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const inferProductName = (id: string, config?: Record<string, unknown>) => {
  const productType = config?.productType;
  if (typeof productType === "string" && productType.length) return productType;

  const entityName = config?.entityName;
  if (typeof entityName === "string" && entityName.length) {
    if (entityName === id) {
      const lastDash = entityName.lastIndexOf("-");
      if (lastDash > 0) {
        const suffix = entityName.slice(lastDash + 1);
        if (suffix.length >= 6) return entityName.slice(0, lastDash);
      }
    }
    return entityName;
  }

  const lastDash = id.lastIndexOf("-");
  if (lastDash > 0) {
    const suffix = id.slice(lastDash + 1);
    if (suffix.length >= 6) return id.slice(0, lastDash);
  }

  return id;
};

export const buildPresetFromConfiguration = (
  configuration: Record<string, unknown>,
  orderedIds?: string[],
): PresetProduct[] => {
  const ids = orderedIds?.length ? orderedIds : Object.keys(configuration);

  return ids
    .map((id) => {
      const configRaw = configuration[id];
      if (!isRecord(configRaw)) return null;

      const config = configRaw as ConfigurationMap[string];

      const name = inferProductName(id, config);

      const preset: PresetProduct = { name };

      if (typeof config.Width === "number") preset.Width = config.Width;
      if (typeof config.Height === "number") preset.Height = config.Height;
      if (typeof config.Depth === "number") preset.Depth = config.Depth;
      if (typeof config.CabinetColor === "string") preset.CabinetColor = config.CabinetColor;
      if (typeof config.Drawers === "string") preset.Drawers = config.Drawers;
      if (typeof config.sinkType === "string") preset.sinkType = config.sinkType;
      if (typeof config.CountertopColor === "string") preset.CountertopColor = config.CountertopColor;
      if (typeof config.HandleGrooveColor === "string") preset.HandleGrooveColor = config.HandleGrooveColor;

      return preset;
    })
    .filter((item): item is PresetProduct => Boolean(item));
};
