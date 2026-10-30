import { buildSidePanelSku, SIDE_PANEL_WIDTH_CM, type SkuSeries } from "@/shared/lib/sku";

import type { PricingInput, PricingLine } from "./types";

/**
 * The Urban Standard Height side panel (D02): one SKU for the panels of the composition, ordered
 * once per active side and naming those ends (`sides`), spelled
 * `VAN-{sidePanel}-{groove}-…-CAB-{material}-{code}[-HDL-…]` at the cabinets' height and depth, in the
 * cabinet's finish. USH prices its own with it, and so does a collection whose SKU profile prices its side
 * panels as USH's (Urban Low Height). Each caller brings the colours.
 */

/** The id of the panel line: one line for both ends. */
export const USH_SIDE_PANEL_LINE_ID = "sidePanel";

type ColorSku = { materialSku: string | null; colorCode: string | null };

export type UshSidePanelLinesInput = {
  series: SkuSeries;
  /** `SidePanels`: `None`, `NoG`, `UpperG`, … */
  panelType: string;
  sidePanelLeft: PricingInput["sidePanelLeft"];
  sidePanelRight: PricingInput["sidePanelRight"];
  heightCm: number | null;
  depthCm: number | null;
  /** The cabinet's colour as its palette names it (`color`), which Summary shows as the panel's finish. */
  cabinet: ColorSku & { color: string | null };
  /** A grooved panel's groove; without a colour of its own it is spelled in the cabinet's. */
  groove: ColorSku;
};

export const buildUshSidePanelLines = ({
  series,
  panelType,
  sidePanelLeft,
  sidePanelRight,
  heightCm,
  depthCm,
  cabinet,
  groove,
}: UshSidePanelLinesInput): PricingLine[] => {
  const sides = (["left", "right"] as const).filter(
    (side) => (side === "left" ? sidePanelLeft : sidePanelRight) === "active",
  );
  if (sides.length === 0) return [];

  const sku = buildSidePanelSku(
    { series },
    {
      panelType,
      width: SIDE_PANEL_WIDTH_CM,
      height: heightCm,
      depth: depthCm,
      cabMaterialSku: cabinet.materialSku,
      cabColorCode: cabinet.colorCode,
      hdlMaterialSku: groove.materialSku,
      hdlColorCode: groove.colorCode,
    },
  );
  if (!sku) return [];

  const finish =
    cabinet.color && cabinet.materialSku ? { color: cabinet.color, materialSku: cabinet.materialSku } : null;
  return [
    {
      id: USH_SIDE_PANEL_LINE_ID,
      group: "sidePanel",
      sku,
      quantity: sides.length,
      sides,
      ...(finish ? { finish } : {}),
    },
  ];
};
