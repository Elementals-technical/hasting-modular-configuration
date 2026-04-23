import type { PresetProduct } from "../types";
import type { PrebuiltModelTransferableOverrides } from "./prebuiltModelTransferableFields";

export const mergePrebuiltModelTransferableOverrides = (
  presetProducts: PresetProduct[] = [],
  overrides: PrebuiltModelTransferableOverrides,
): PresetProduct[] => {
  if (!presetProducts.length) return presetProducts;
  if (!Object.keys(overrides).length) return presetProducts;

  return presetProducts.map((preset) => ({
    ...preset,
    ...overrides,
  }));
};
