import type { PresetProduct } from "../types";

type StringPresetField = {
  [K in keyof PresetProduct]-?: PresetProduct[K] extends string | undefined ? K : never;
}[keyof PresetProduct];

export const PREBUILT_MODEL_COLOR_TRANSFERABLE_FIELDS = ["CabinetColor", "HandleGrooveColor"] as const satisfies readonly StringPresetField[];

export const PREBUILT_MODEL_COUNTERTOP_TRANSFERABLE_FIELDS = ["CountertopColor", "sinkType"] as const satisfies readonly StringPresetField[];

export const PREBUILT_MODEL_TRANSFERABLE_FIELDS = [
  ...PREBUILT_MODEL_COLOR_TRANSFERABLE_FIELDS,
  ...PREBUILT_MODEL_COUNTERTOP_TRANSFERABLE_FIELDS,
] as const satisfies readonly StringPresetField[];

export type PrebuiltModelTransferableField = (typeof PREBUILT_MODEL_TRANSFERABLE_FIELDS)[number];

export type PrebuiltModelTransferableOverrides = Partial<Pick<PresetProduct, PrebuiltModelTransferableField>>;

export const pickPrebuiltModelTransferableOverrides = (
  source?: Partial<PresetProduct> | null,
  fields: readonly PrebuiltModelTransferableField[] = PREBUILT_MODEL_TRANSFERABLE_FIELDS,
): PrebuiltModelTransferableOverrides => {
  if (!source) return {};

  const overrides: PrebuiltModelTransferableOverrides = {};

  for (const field of fields) {
    const value = source[field];

    if (typeof value === "string" && value.trim()) {
      overrides[field] = value;
    }
  }

  return overrides;
};

export const resolvePrebuiltModelTransferableOverrides = (args: {
  presetProducts?: Partial<PresetProduct>[] | null;
  selectedOptions?: Partial<PresetProduct> | null;
  fields?: readonly PrebuiltModelTransferableField[];
}): PrebuiltModelTransferableOverrides => {
  const fields = args.fields ?? PREBUILT_MODEL_TRANSFERABLE_FIELDS;
  const overrides = pickPrebuiltModelTransferableOverrides(args.selectedOptions, fields);

  for (const field of fields) {
    if (typeof overrides[field] === "string" && overrides[field]?.trim()) continue;

    const presetValue = args.presetProducts?.find((preset) => {
      const value = preset?.[field];
      return typeof value === "string" && value.trim();
    })?.[field];

    if (typeof presetValue === "string" && presetValue.trim()) {
      overrides[field] = presetValue;
    }
  }

  return overrides;
};
