import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import {
  getConfiguratorVariantOverrides,
  isHiddenConfiguratorDisplayValue,
} from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

import type { FieldOptionState } from "@/entities/collection";

/** The first non-empty string among configurator metadata candidates. */
export const pick = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === "string" && value.length > 0);

export const fromCsv = (value: unknown): string[] =>
  typeof value === "string"
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

/** The visible variants of one configurator section as field options, with the traits the colour grid filters by. */
export const buildConfiguratorOptions = (group: ConfiguratorAvailableOption | undefined): FieldOptionState[] => {
  if (!group) return [];

  return group.options.flatMap((option) =>
    option.variants.flatMap((variant) => {
      if (!isVisibleConfiguratorVariant(variant)) return [];

      const meta: Record<string, unknown> = variant.metadata ?? {};
      const nested: Record<string, unknown> =
        typeof meta.metadata === "object" && meta.metadata ? (meta.metadata as Record<string, unknown>) : {};
      const overrides = getConfiguratorVariantOverrides({ proxyName: group.proxyName, variant });
      const label = pick(meta.label, meta.Label, nested.label, nested.Label, overrides.label) ?? variant.name;
      const value = pick(meta.value, nested.value, overrides.value) ?? variant.name;

      if (isHiddenConfiguratorDisplayValue(label) || isHiddenConfiguratorDisplayValue(value)) return [];

      const materials = fromCsv(pick(nested.Material, meta.Material));
      // The option name is a material only where the section is split by material, as configurator 4
      // splits it. Configurator 9 keeps one option named after the attribute and puts the material on
      // the variant, so there the name says nothing and the variant is the only source.
      const optionMaterial = group.options.length > 1 ? option.name : undefined;

      return [
        {
          value,
          label,
          enabled: true,
          image: overrides.image ?? pick(nested.image, meta.image, variant.image),
          desc: optionMaterial ?? materials[0] ?? group.proxyName,
          traits: {
            sku: pick(meta.sku, nested.sku),
            // The section name is never a material; it used to be filtered back out by the colour grid.
            materials: [...new Set(optionMaterial ? [optionMaterial, ...materials] : materials)],
            colors: fromCsv(pick(nested.Color, meta.Color)),
            looks: fromCsv(pick(nested.Look, meta.Look)),
            hex: pick(nested.hex, meta.hex)?.trim(),
          },
        },
      ];
    }),
  );
};
