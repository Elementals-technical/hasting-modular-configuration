import { buildTowelBarSku, TOWEL_BAR_DEFAULTS, type SkuSeries } from "@/shared/lib/sku";

import type { PricingLine } from "./types";

/**
 * The Urban Standard Height towel bar (D02): one line per side it hangs on, spelled
 * `VAN-{towelBar}-STB/L|R-…-LACM-{code}`. USH prices its own with it, and so does a collection
 * whose SKU profile prices its towel bar as USH's (Urban Low Height).
 */

export type UshTowelBarLinesInput = {
  series: SkuSeries;
  /** `TowelBarOption`: `None`, `Left`, `Right` or `Both`. */
  towelBarOption: string;
  towelBarColor: string;
};

export const buildUshTowelBarLines = ({
  series,
  towelBarOption,
  towelBarColor,
}: UshTowelBarLinesInput): PricingLine[] => {
  const sides = [
    { id: "towelBar:right", side: "R", hangs: towelBarOption === "Right" || towelBarOption === "Both" },
    { id: "towelBar:left", side: "L", hangs: towelBarOption === "Left" || towelBarOption === "Both" },
  ] as const;

  return sides.flatMap(({ id, side, hangs }) => {
    if (!hangs) return [];

    const sku = buildTowelBarSku(
      { series },
      { side, ...TOWEL_BAR_DEFAULTS, materialSku: "LACM", colorCode: towelBarColor || null },
    );
    return sku ? [{ id, group: "towelBar" as const, sku, quantity: 1 }] : [];
  });
};
