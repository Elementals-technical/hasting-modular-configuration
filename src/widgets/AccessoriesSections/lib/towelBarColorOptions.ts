import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { getConfiguratorGroupKind } from "@/entities/configurator/lib/configuratorGroupKind";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

const ALLOWED_CODES = ["0b mt", "43 mt", "m6 mt", "m7 mt", "03 mt"];
const LACQUERED_MT_MARKERS = ["lacquered mt", "lacquer mt", "lacquered matte", "lacquer matte"];

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * The towel bar colours: the lacquered matte colours of the configurator section, by their codes.
 * Configurator 4 splits the section by material; a collection's own configurator names the material
 * on the variant, under one option called after the section.
 */
export const buildTowelBarColorOptions = (groups: ConfiguratorAvailableOption[]): ProductOptionData[] =>
  groups
    .filter((group) => getConfiguratorGroupKind(group.proxyName) === "towelBar")
    .flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = (variant.metadata ?? {}) as Record<string, unknown>;
            return {
              id: variant.id,
              title: text(meta.label) ?? text(meta.Label) ?? variant.name,
              name: variant.name,
              desc: text(meta.Material) ?? option.name ?? group.proxyName,
              isShortDesc: false,
              metadata: {
                image: text(meta.image) ?? variant.image ?? undefined,
                value: text(meta.value) ?? variant.name,
                hex: text(meta.hex),
              },
            };
          })
          .filter((item) => {
            const haystack = `${item.title} ${item.name} ${item.metadata.value} ${item.desc}`.toLowerCase();
            return (
              ALLOWED_CODES.some((code) => haystack.includes(code)) &&
              LACQUERED_MT_MARKERS.some((m) => haystack.includes(m))
            );
          }),
      ),
    );
