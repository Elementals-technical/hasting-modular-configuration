import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import {
  getConfiguratorVariantOverrides,
  isHiddenConfiguratorDisplayValue,
} from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

import type { FieldOptionState } from "@/entities/collection";

const pick = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === "string" && value.length > 0);

const fromCsv = (value: unknown): string[] =>
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
      if (!isVisibleConfiguratorVariant({ proxyName: group.proxyName, variant })) return [];

      const meta: Record<string, unknown> = variant.metadata ?? {};
      const nested: Record<string, unknown> =
        typeof meta.metadata === "object" && meta.metadata ? (meta.metadata as Record<string, unknown>) : {};
      const overrides = getConfiguratorVariantOverrides({ proxyName: group.proxyName, variant });
      const label = pick(meta.label, meta.Label, nested.label, nested.Label, overrides.label) ?? variant.name;
      const value = pick(meta.value, nested.value, overrides.value) ?? variant.name;

      if (isHiddenConfiguratorDisplayValue(label) || isHiddenConfiguratorDisplayValue(value)) return [];

      return [
        {
          value,
          label,
          enabled: true,
          image: overrides.image ?? pick(nested.image, meta.image, variant.image),
          desc: option.name ?? group.proxyName,
          traits: {
            sku: pick(meta.sku, nested.sku),
            materials: [
              ...new Set(
                [group.proxyName, option.name, ...fromCsv(pick(nested.Material, meta.Material))].filter(Boolean),
              ),
            ],
            colors: fromCsv(pick(nested.Color, meta.Color)),
            looks: fromCsv(pick(nested.Look, meta.Look)),
            hex: pick(nested.hex, meta.hex)?.trim(),
          },
        },
      ];
    }),
  );
};
