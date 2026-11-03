import type { ProductSize, ProductStyle } from "../types";

const ALL_OPTION = { label: "All", value: "all" };

const SIZE_OPTIONS: ReadonlyArray<{ label: string; value: ProductSize }> = [
  { label: "24–29″", value: "24_29" },
  { label: "30–39″", value: "30_39" },
  { label: "40–49″", value: "40_49" },
  { label: "50–59″", value: "50_59" },
  { label: "60–69″", value: "60_69" },
  { label: "70–79″", value: "70_79" },
  { label: "80–89″", value: "80_89" },
  { label: "90″+", value: "90_plus" },
];

const STYLE_OPTIONS: ReadonlyArray<{ label: string; value: ProductStyle }> = [
  { label: "1 Drawer", value: "1_drawer" },
  { label: "2 Drawer", value: "2_drawer" },
  { label: "Single Basin", value: "single_basin" },
  { label: "Double Basin", value: "double_basin" },
  { label: "Asymmetrical", value: "asymmetrical" },
  { label: "Open Shelving", value: "open_shelving" },
  { label: "Multi-level", value: "multi_level" },
];

/** What the model filters read of a collection's preset. */
type FilterablePreset = { size: ProductSize; style: readonly ProductStyle[] };

export type PresetFilters = { size: ProductSize | "all"; style: ProductStyle | "all" };

export const matchesPresetFilters = (preset: FilterablePreset, { size, style }: PresetFilters): boolean =>
  (size === "all" || preset.size === size) && (style === "all" || preset.style.includes(style));

/**
 * The values of the model filters: those the collection's models have, so a value without a model
 * is not offered. One that leaves no model with the other filter's value is disabled.
 */
export const buildPresetFilterOptions = (presets: readonly FilterablePreset[], filters: PresetFilters) => {
  const hasModels = (candidate: PresetFilters) => presets.some((preset) => matchesPresetFilters(preset, candidate));

  return {
    size: [
      ALL_OPTION,
      ...SIZE_OPTIONS.filter(({ value }) => hasModels({ size: value, style: "all" })).map((option) => ({
        ...option,
        disabled: !hasModels({ ...filters, size: option.value }),
      })),
    ],
    style: [
      ALL_OPTION,
      ...STYLE_OPTIONS.filter(({ value }) => hasModels({ size: "all", style: value })).map((option) => ({
        ...option,
        disabled: !hasModels({ ...filters, style: option.value }),
      })),
    ],
  };
};
