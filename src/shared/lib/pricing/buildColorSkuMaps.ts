import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import { getConfiguratorVariantOverrides } from "@/entities/configurator/lib/getConfiguratorVariantOverrides";
import { buildCountertopColorSkuCandidates } from "@/shared/lib/sku";

import type { ColorSkuMaps } from "./types";

/** Colour value → material SKU of the configurator sections the price reads. */
export const buildColorSkuMaps = (groups: readonly ConfiguratorAvailableOption[]): ColorSkuMaps => {
  const buildMapForProxy = (proxyName: string) => {
    const map = new Map<string, string>();
    groups
      .filter((group) => group.proxyName === proxyName)
      .forEach((group) => {
        group.options.forEach((option) => {
          option.variants?.forEach((variant) => {
            if (!variant.enabled) return;
            const meta = (variant.metadata ?? {}) as Record<string, unknown>;
            const overrides = getConfiguratorVariantOverrides({ proxyName, variant });
            const value = overrides.value || (meta.value as string) || variant.name;
            const sku = (meta.sku as string) || "";
            if (value && sku) map.set(value, sku);
          });
        });
      });
    return map;
  };

  return {
    cabinetColorSkuByName: buildMapForProxy("Cabinet Color"),
    handleGrooveColorSkuByName: buildMapForProxy("Handle Groove Color"),
    countertopColorSkuCandidatesByValue: buildCountertopColorSkuCandidates([...groups]),
  };
};
