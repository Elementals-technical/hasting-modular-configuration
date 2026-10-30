import { buildSummaryMaterialElements } from "@/shared/lib/summaryMaterialElements";

import type { SummaryLinePrice } from "./summaryLinePrice";
import type { PricingInput, PricingLine } from "./types";

/** The order line of a collection's own side panels (Tricot): one SKU for the panels at both ends. */
export const OWN_SIDE_PANEL_LINE_ID = "sidePanel:composition";

/** The order lines of a collection's own side panels priced per end (Lame): each in its end cabinet's variant. */
export const OWN_SIDE_PANEL_END_LINE_IDS = { left: "sidePanel:left", right: "sidePanel:right" } as const;

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
  /** The width a panel priced per end is described at; a composition panel's SKU names no size, so neither does its item. */
  panelWidthCm: number;
};

type Side = keyof typeof OWN_SIDE_PANEL_END_LINE_IDS;

const SIDES: ReadonlyArray<{ side: Side; title: string }> = [
  { side: "left", title: "Side Panel Left" },
  { side: "right", title: "Side Panel Right" },
];

/**
 * Summary items of a collection's own side panels, in the finish each line is ordered in.
 * - A composition line (Tricot): one item per active side, each a piece of the line (its quantity counts the
 *   active sides). Example: VAN-TRIC-SP-.8W-15.7H-20.5D-CAB-WDV-933 of 2 -> "Side Panel Left" and "Side Panel
 *   Right" in Noce Canaletto 933, Material WDV.
 * - A line per end (Lame): one item per line, in that end cabinet's finish. The choice reads only "Yes", so the
 *   item has no subtitle. Example: VAN-LAMEV-SP/2DW/OXF-…-CAB-LACG-417 at the left -> "Side Panel Left" in
 *   Latte 417 GL, Material LACG.
 */
export const ownSidePanelItems = (
  lines: ReadonlyArray<PricingLine>,
  { priceOfLine, swatchOf, sidePanelLeft, sidePanelRight, panelType, panelWidthCm }: OwnSidePanelItemOptions,
): OwnSidePanelItem[] => {
  const itemOf = (
    line: PricingLine,
    side: Side,
    title: string,
    look: { subtitle?: string; description: Record<string, unknown> },
  ): OwnSidePanelItem => {
    const { finish } = line;
    const swatch = finish ? swatchOf(finish.color) : null;

    return {
      id: `accessories-side-panel-${side}`,
      title,
      subtitle: look.subtitle,
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
        ...look.description,
        Side: side,
        "Cabinet Color": finish?.color ?? null,
        elements: buildSummaryMaterialElements([
          { productElement: "Cabinet", materialSku: finish?.materialSku, colorCode: finish?.color },
        ]),
      },
    };
  };

  const composition = lines.find(({ id }) => id === OWN_SIDE_PANEL_LINE_ID);
  const statusOf = { left: sidePanelLeft, right: sidePanelRight };
  const compositionItems = composition
    ? SIDES.filter(({ side }) => statusOf[side] === "active").map(({ side, title }) =>
        itemOf(composition, side, title, {
          subtitle: panelType ?? undefined,
          description: { "Panel Type": panelType },
        }),
      )
    : [];

  const endItems = SIDES.flatMap(({ side, title }) => {
    const line = lines.find(({ id }) => id === OWN_SIDE_PANEL_END_LINE_IDS[side]);
    return line ? [itemOf(line, side, title, { description: { Width: panelWidthCm } })] : [];
  });

  return [...compositionItems, ...endItems];
};
