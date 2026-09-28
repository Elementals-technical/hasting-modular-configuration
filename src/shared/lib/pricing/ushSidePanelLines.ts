import { buildSidePanelSku, SIDE_PANEL_WIDTH_CM, type SkuSeries } from "@/shared/lib/sku";

import type { PricingInput, PricingLine } from "./types";

/**
 * The Urban Standard Height side panel (D02): one SKU for the panels of the composition, ordered
 * once per active side, spelled `VAN-{sidePanel}-{groove}-…-CAB-{material}-{code}[-HDL-…]` at the
 * cabinets' height and depth. USH prices its own with it, and so does a collection whose SKU
 * profile prices its side panels as USH's (Urban Low Height). Each caller brings the colours.
 */

type ColorSku = { materialSku: string | null; colorCode: string | null };

export type UshSidePanelLinesInput = {
  series: SkuSeries;
  /** `SidePanels`: `None`, `NoG`, `UpperG`, … */
  panelType: string;
  sidePanelLeft: PricingInput["sidePanelLeft"];
  sidePanelRight: PricingInput["sidePanelRight"];
  heightCm: number | null;
  depthCm: number | null;
  cabinet: ColorSku;
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
  const activeSideCount = [sidePanelLeft, sidePanelRight].filter((status) => status === "active").length;
  if (activeSideCount === 0) return [];

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
  return sku ? [{ id: "sidePanel", group: "sidePanel", sku, quantity: activeSideCount }] : [];
};
