import type { PresetProduct } from "@/entities/product/types";

type ConfigurationMap = Record<string, Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const stripRuntimeSuffix = (value: string): string => {
  const trimmed = value.trim();
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash > 0) {
    const suffix = trimmed.slice(lastDash + 1);
    if (suffix.length >= 6) return trimmed.slice(0, lastDash);
  }
  return trimmed;
};

const toCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const toCanonicalCabinetName = (value: string) => {
  const compact = toCompact(value);
  if (compact.includes("sinkbase")) return "Sink-Base";
  if (compact.includes("sinkcabinet")) return "Sink-Cabinet";
  if (compact.includes("sidecabinet")) return "Side-Cabinet";
  if (compact.includes("openshelf")) return "Open-Shelf";
  if (compact.includes("sideshelf")) return "Side-Shelf";
  return value;
};

const readString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

const readNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
};

const inferProductName = (id: string, config?: Record<string, unknown>) => {
  const productType = config?.productType ?? config?.ProductType;
  if (typeof productType === "string" && productType.length) {
    return toCanonicalCabinetName(stripRuntimeSuffix(productType));
  }

  const entityName = config?.entityName ?? config?.EntityName;
  if (typeof entityName === "string" && entityName.length) {
    return toCanonicalCabinetName(stripRuntimeSuffix(entityName));
  }

  return toCanonicalCabinetName(stripRuntimeSuffix(id));
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

      const width = readNumber(config, ["Width", "width"]);
      const height = readNumber(config, ["Height", "height"]);
      const depth = readNumber(config, ["Depth", "depth"]);
      const cabinetColor = readString(config, ["CabinetColor", "cabinetColor"]);
      const drawers = readString(config, ["Drawers", "drawers"]);
      const handle = readString(config, ["Handle", "handle", "HandleType", "handleType"]);
      const sinkType = readString(config, ["sinkType", "SinkType"]);
      const countertopColor = readString(config, ["CountertopColor", "countertopColor"]);
      const handleGrooveColor = readString(config, ["HandleGrooveColor", "handleGrooveColor"]);

      if (typeof width === "number") preset.Width = width;
      if (typeof height === "number") preset.Height = height;
      if (typeof depth === "number") preset.Depth = depth;
      if (cabinetColor) preset.CabinetColor = cabinetColor;
      if (drawers) preset.Drawers = drawers;
      if (handle) preset.Handle = handle;
      if (sinkType) preset.sinkType = sinkType;
      if (countertopColor) preset.CountertopColor = countertopColor;
      if (handleGrooveColor) preset.HandleGrooveColor = handleGrooveColor;

      return preset;
    })
    .filter((item): item is PresetProduct => Boolean(item));
};
