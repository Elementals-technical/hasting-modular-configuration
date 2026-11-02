import type { PresetProduct, ProductModel } from "../types";
import { arePrebuiltModelPresetsEqual } from "./arePrebuiltModelPresetsEqual";

type ActivePrebuiltPresetSources = {
  presets: readonly Pick<ProductModel, "id" | "presetProducts">[];
  /** The preset the URL names, when the catalog holds it. */
  presetIdFromUrl: number | null;
  /** A saved configuration is open: the composition is the saved one, whatever preset the URL names. */
  hasConfigIdInUrl: boolean;
  productsPresets: PresetProduct[];
  placedProductIds: readonly string[];
  defaultPresetId: number | null;
};

/**
 * The model card to highlight: the preset the URL names, else the one equal to the state. A composition
 * no preset equals highlights nothing, since no highlight beats a wrong one; the default preset is
 * only for a scene nothing was placed in yet.
 *
 * An empty state is never compared: a compact preset has no `presetProducts` and would equal it.
 */
export const resolveActivePrebuiltPresetId = ({
  presets,
  presetIdFromUrl,
  hasConfigIdInUrl,
  productsPresets,
  placedProductIds,
  defaultPresetId,
}: ActivePrebuiltPresetSources): number | null => {
  if (presetIdFromUrl !== null && !hasConfigIdInUrl) return presetIdFromUrl;

  const hasPresetProducts = productsPresets.length > 0;
  const match = hasPresetProducts
    ? presets.find((preset) => arePrebuiltModelPresetsEqual(preset.presetProducts, productsPresets))
    : undefined;
  if (match) return match.id;

  return hasPresetProducts || placedProductIds.length > 0 ? null : defaultPresetId;
};
