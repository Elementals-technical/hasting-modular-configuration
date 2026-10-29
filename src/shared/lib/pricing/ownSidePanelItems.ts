import { buildSummaryMaterialElements } from "@/shared/lib/summaryMaterialElements";

import type { SummaryLinePrice } from "./summaryLinePrice";
import type { PricingInput, PricingLine } from "./types";

/** The order line of a collection's own side panels (Tricot): one SKU for the panels at both ends. */
export const OWN_SIDE_PANEL_LINE_ID = "sidePanel:composition";

export type OwnSidePanelItem = SummaryLinePrice & {
  id: string;
  title: string;
  subtitle?: string;
  swatch?: { label: string; value: string; color: string; image?: string; materialSku: string };
  copyable: boolean;
  showInfo: boolean;
  description: Record<string, unknown>;
};

type OwnSidePanelItemOptions = {
  priceOfLine: (line: PricingLine) => SummaryLinePrice;
  /** The page's look of a colour: its swatch colour and picture. */
  swatchOf: (color: string) => { color: string; image?: string };
  sidePanelLeft: PricingInput["sidePanelLeft"];
  sidePanelRight: PricingInput["sidePanelRight"];
  /** The label of the chosen panel, e.g. `No groove`. */
  panelType: string | null;
};

const SIDES = [
  { side: "left", title: "Side Panel Left" },
  { side: "right", title: "Side Panel Right" },
] as const;

/**
 * Summary items of a collection's own side panels: one per active side, each a piece of the panel line
 * (its quantity counts the active sides), in the finish the line is ordered in. The SKU has no groove and
 * names no size of its own, so neither does the item.
 * Example: VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933 of 2 -> "Side Panel Left" and "Side Panel Right" in
 * Noce Canaletto 933, Material WDV.
 */
export const ownSidePanelItems = (
  lines: ReadonlyArray<PricingLine>,
  { priceOfLine, swatchOf, sidePanelLeft, sidePanelRight, panelType }: OwnSidePanelItemOptions,
): OwnSidePanelItem[] => {
  const line = lines.find(({ id }) => id === OWN_SIDE_PANEL_LINE_ID);
  if (!line) return [];

  const { finish } = line;
  const swatch = finish ? swatchOf(finish.color) : null;
  const statusOf = { left: sidePanelLeft, right: sidePanelRight };

  return SIDES.filter(({ side }) => statusOf[side] === "active").map(({ side, title }) => ({
    id: `accessories-side-panel-${side}`,
    title,
    subtitle: panelType ?? undefined,
    ...priceOfLine(line),
    swatch:
      finish && swatch
        ? {
            label: "Cabinet",
            value: finish.color,
            color: swatch.color,
            image: swatch.image,
            materialSku: finish.materialSku,
          }
        : undefined,
    copyable: true,
    showInfo: true,
    description: {
      "Product Category": "Side Panel",
      "Panel Type": panelType,
      Side: side,
      "Cabinet Color": finish?.color ?? null,
      elements: buildSummaryMaterialElements([
        { productElement: "Cabinet", materialSku: finish?.materialSku, colorCode: finish?.color },
      ]),
    },
  }));
};
