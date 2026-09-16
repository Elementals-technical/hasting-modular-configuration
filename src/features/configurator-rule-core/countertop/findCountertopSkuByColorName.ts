import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { normalizeMaterialToken } from "./parse";

const MATERIAL_SKU_BY_TOKEN: Record<string, string> = {
  fenix: "FX",
  hpl: "HPL",
  porcelain: "POR",
  glass: "GLSM",
  glassmt: "GLSM",
  glassgl: "GLSG",
  mineralmarmo: "SSMMO",
  minermalmaro: "SSMMO",
  ocritech: "SSOCR",
  tekorlux: "SSTKR",
  tal: "SSTKR",
  tam: "SSTKR",
  tekormud: "SSTM",
  tekorund: "SSTM",
};

const COUNTERTOP_PROXY_NAMES = new Set(["Countertop Color", "Vessels"]);

type ConfiguratorGroupSource =
  | readonly ConfiguratorAvailableOption[]
  | { availableOptions: readonly ConfiguratorAvailableOption[] };

export const findCountertopSkuByColorName = (
  source: ConfiguratorGroupSource | null | undefined,
  colorName: string,
): string => {
  if (!source || !colorName) return "";

  const groups = "availableOptions" in source ? source.availableOptions : source;

  for (const group of groups) {
    if (!COUNTERTOP_PROXY_NAMES.has(group.proxyName)) continue;

    for (const option of group.options) {
      for (const variant of option.variants) {
        if (!variant.enabled) continue;

        const metaValue = typeof variant.metadata?.value === "string" ? variant.metadata.value : null;
        if (metaValue !== colorName && variant.name !== colorName) continue;

        const mapped = MATERIAL_SKU_BY_TOKEN[normalizeMaterialToken(option.name ?? "")];
        if (mapped) return mapped;

        const metaSku = typeof variant.metadata?.sku === "string" ? variant.metadata.sku : "";
        if (metaSku) return metaSku;
      }
    }
  }

  return "";
};
