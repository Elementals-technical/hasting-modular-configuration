import {
  normalizeOptionValue,
  selectAttribute,
  selectConfiguratorGroup,
  selectConfiguratorSection,
} from "@/entities/collection";
import type { ProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

/** What a colour says about itself in the configurator: its material SKU and the material's name. */
export type ConfiguratorColor = { sku: string; material: string | null };

/** Null when the attribute does not take its options from the configurator, or the colour is not offered. */
export type ConfiguratorColorReader = (attributeId: string, value: string) => ConfiguratorColor | null;

const pickString = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === "string" && value.length > 0);

/**
 * The material of a colour, read from the configurator section its attribute names.
 *
 * A collection that writes its colours out itself names their material through the option
 * category: the SKU profile maps that category to a code, and a gap can be declared for it. One
 * that takes its colours from the configurator has no category, and both come from the variant —
 * the SKU is the code the category mapped to, and `Material` is the name the category carried.
 */
export const createConfiguratorColorReader = (
  productProfile: ProductProfile | null,
  configurator: ConfiguratorGroupCatalog | null,
): ConfiguratorColorReader => {
  // Keyed by the whole source: two attributes may read different options of one section.
  const bySource = new Map<string, Map<string, ConfiguratorColor>>();

  const sourceColors = (attributeId: string, source: string): Map<string, ConfiguratorColor> => {
    const cached = bySource.get(source);
    if (cached) return cached;

    const colors = new Map<string, ConfiguratorColor>();
    selectConfiguratorGroup(productProfile, attributeId, configurator)?.options.forEach((option) =>
      option.variants.forEach((variant) => {
        if (!isVisibleConfiguratorVariant(variant)) return;

        const meta: Record<string, unknown> = variant.metadata ?? {};
        const nested: Record<string, unknown> =
          typeof meta.metadata === "object" && meta.metadata ? (meta.metadata as Record<string, unknown>) : {};
        const sku = pickString(meta.sku, nested.sku);

        if (sku) {
          colors.set(pickString(meta.value, nested.value) ?? variant.name, {
            sku,
            material: pickString(nested.Material, meta.Material) ?? null,
          });
        }
      }),
    );

    bySource.set(source, colors);
    return colors;
  };

  return (attributeId, value) => {
    const attribute = selectAttribute(productProfile, attributeId);
    const source = attribute?.optionsSource;
    if (!source || !selectConfiguratorSection(productProfile, attributeId)) return null;
    const canonical = normalizeOptionValue(productProfile, attributeId, value);
    if (attribute?.options && !canonical) return null;
    const colors = sourceColors(attributeId, source);
    const direct = colors.get(value);
    if (direct) return direct;
    if (canonical) {
      for (const [external, metadata] of colors)
        if (normalizeOptionValue(productProfile, attributeId, external) === canonical) return metadata;
    }
    return null;
  };
};
