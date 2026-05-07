import type { PresetProduct } from "@/entities/product/types";
import { resolveRuntimeProductType } from "@/entities/product/lib/resolveRuntimeProductType";

type ConfigurationMap = Record<string, Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

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

      const name = resolveRuntimeProductType(id, config);

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
