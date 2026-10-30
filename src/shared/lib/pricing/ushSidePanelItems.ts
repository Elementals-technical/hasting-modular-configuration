import { buildSummaryMaterialElements } from "@/shared/lib/summaryMaterialElements";

import type { SummaryLinePrice } from "./summaryLinePrice";
import type { PricingLine } from "./types";
import { USH_SIDE_PANEL_LINE_ID } from "./ushSidePanelLines";

export type UshSidePanelItem = SummaryLinePrice & {
  id: string;
  title: string;
  subtitle?: string;
  swatch?: { label: string; value: string; color: string; image?: string; materialSku: string };
  copyable: boolean;
  showInfo: boolean;
  description: Record<string, unknown>;
};

type UshSidePanelItemOptions = {
  priceOfLine: (line: PricingLine) => SummaryLinePrice;
  /** The page's look of a colour: its swatch colour and picture. */
  swatchOf: (color: string) => { color: string; image?: string };
  /** The label of the chosen panel, e.g. `Upper Groove`. */
  panelType: string | null;
  /** The size the panels are described at: the collection's panel width, the height and depth of the first cabinet. */
  size: { widthCm: number; heightCm: number | null; depthCm: number | null };
  /** The groove's colour and material, which a grooved panel is painted in. */
  groove: { color: string | null; materialSku: string | null };
};

const SIDE_TITLE = { left: "Side Panel Left", right: "Side Panel Right" } as const;

/** The depths the scene measures a panel at, as the price list names them. */
const DESCRIBED_DEPTH_CM: Record<number, number> = { 46: 45.5, 50.5: 50 };

const describedDepth = (depthCm: number | null): number | null => {
  if (depthCm === null) return null;
  return DESCRIBED_DEPTH_CM[Math.round(depthCm * 10) / 10] ?? depthCm;
};

/**
 * Summary items of the Urban Standard Height side panel line (USH, and the collections that price their
 * panels as USH's): one per end the line orders, each a piece of it, in the finish the line is ordered in.
 * An end the line does not order is not listed: the panel beside a short cabinet (UFS-SP-01).
 * Example: VAN-URSP-0G-.4W-35.8H-19.7D-CAB-3D-1C1 of 1 for the right end -> "Side Panel Right" in
 * Castagno chiaro 1C1, Material 3D.
 */
export const ushSidePanelItems = (
  lines: ReadonlyArray<PricingLine>,
  { priceOfLine, swatchOf, panelType, size, groove }: UshSidePanelItemOptions,
): UshSidePanelItem[] => {
  const line = lines.find(({ id }) => id === USH_SIDE_PANEL_LINE_ID);
  if (!line) return [];

  const { finish } = line;
  const swatch = finish ? swatchOf(finish.color) : null;
  const elements = buildSummaryMaterialElements([
    { productElement: "Cabinet", materialSku: finish?.materialSku, colorCode: finish?.color },
    { productElement: "Handle", materialSku: groove.materialSku, colorCode: groove.color },
  ]);

  return (line.sides ?? []).map((side) => ({
    id: `accessories-side-panel-${side}`,
    title: SIDE_TITLE[side],
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
      Width: size.widthCm,
      Height: size.heightCm,
      Depth: describedDepth(size.depthCm),
      "Cabinet Color": finish?.color ?? null,
      "Groove Color": groove.color,
      elements,
    },
  }));
};
