import { normalizeOptionValue, resolveCabinetTypeOfRuntimeId, semanticValueOf } from "@/entities/collection";
import type { ProductProfile, RuntimeBindingSet } from "@/entities/collection";
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

/**
 * Presets from scene configs (`getConfig`, or a saved configuration). The scene names a product after
 * its scene type ("Mako-sink-cabinet") and a colour after its material ("Agata 407 Lacquered MT"); a
 * preset holds the cabinet type and the colour as the configuration does, which the collection's
 * profile and bindings translate back.
 */
export const buildPresetFromConfiguration = (
  configuration: Record<string, unknown>,
  profile: ProductProfile | null,
  bindings: RuntimeBindingSet | null,
  orderedIds?: string[],
): PresetProduct[] => {
  const ids = orderedIds?.length ? orderedIds : Object.keys(configuration);
  const readColor = (config: Record<string, unknown>, attributeId: string, keys: string[]) => {
    const sceneValue = readString(config, keys);
    return sceneValue ? semanticValueOf(bindings, attributeId, sceneValue) : undefined;
  };

  return ids
    .map((id) => {
      const configRaw = configuration[id];
      if (!isRecord(configRaw)) return null;

      const config = configRaw as ConfigurationMap[string];

      // The id names what the cabinet is now; its config keeps the type it was placed as (a lifted sink).
      const sceneType = resolveRuntimeProductType(id, config);
      const drawers = readString(config, ["Drawers", "drawers"]);
      const placedDrawers = drawers ? normalizeOptionValue(profile, "Drawers", drawers) : null;
      const name =
        resolveCabinetTypeOfRuntimeId(profile, bindings, id, placedDrawers) ??
        resolveCabinetTypeOfRuntimeId(profile, bindings, sceneType, placedDrawers) ??
        sceneType;

      const preset: PresetProduct = { name };

      const width = readNumber(config, ["Width", "width"]);
      const height = readNumber(config, ["Height", "height"]);
      const depth = readNumber(config, ["Depth", "depth"]);
      const cabinetColor = readColor(config, "CabinetColor", ["CabinetColor", "cabinetColor"]);
      const handle = readString(config, ["Handle", "handle", "HandleType", "handleType"]);
      const sinkType = readString(config, ["sinkType", "SinkType"]);
      const countertopColor = readColor(config, "CountertopColor", ["CountertopColor", "countertopColor"]);
      const handleGrooveColor = readColor(config, "HandleGrooveColor", ["HandleGrooveColor", "handleGrooveColor"]);

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
