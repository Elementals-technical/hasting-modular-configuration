import { materialSkuLabelMap } from "@/shared/lib/summaryMaterialElements";

import type { SummaryLinePrice } from "./summaryLinePrice";
import type { PricingLine } from "./types";

export type CabinetCoverItem = SummaryLinePrice & {
  id: string;
  title: string;
  subtitle?: string;
  swatch?: { label: string; value: string; color: string; image?: string; materialSku: string };
  copyable: boolean;
  showInfo: boolean;
  description: Record<string, unknown>;
};

type CabinetCoverItemOptions = {
  priceOfLine: (line: PricingLine) => SummaryLinePrice;
  /** The page's look of a colour: its swatch colour and picture. */
  swatchOf: (color: string) => { color: string; image?: string };
  /** The cover's thickness as the page labels a countertop's, e.g. `1/2"`. */
  thickness: string | null;
};

/**
 * Summary items of the Lower slabs (`cabinetCover` lines), one per piece, in the finish each is ordered in:
 * its colour, as the Upper's palette names it, and its material.
 * Example: a line CT-URHPL-INTG-35.4W-.5H-19.7D-HPL-TKH of 2 at 90 cm -> items "countertop-cabinetCover-0"
 * and "-1", each "Cabinet Cover" in Pulpis Chiaro TKH, Material HPL, Width 90.
 */
export const cabinetCoverItems = (
  lines: ReadonlyArray<PricingLine>,
  { priceOfLine, swatchOf, thickness }: CabinetCoverItemOptions,
): CabinetCoverItem[] =>
  lines
    .filter(({ group }) => group === "cabinetCover")
    .flatMap((line) => {
      const { finish } = line;
      const swatch = finish ? swatchOf(finish.color) : null;
      const material = finish ? (materialSkuLabelMap[finish.materialSku] ?? finish.materialSku) : null;
      return Array.from({ length: line.quantity }, (_, index) => ({
        id: `countertop-${line.id}-${index}`,
        title: "Cabinet Cover",
        subtitle: thickness ?? undefined,
        ...priceOfLine(line),
        swatch:
          finish && swatch
            ? {
                label: "Cabinet Cover",
                value: finish.color,
                color: swatch.color,
                image: swatch.image,
                materialSku: finish.materialSku,
              }
            : undefined,
        copyable: true,
        showInfo: true,
        description: {
          "Product Category": "Cabinet Cover",
          Width: line.widthCm ?? null,
          Thickness: thickness,
          Material: material,
          "Color Code": finish?.color ?? null,
        },
      }));
    });
