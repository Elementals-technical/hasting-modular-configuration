import { cmToInches } from "./cmToInches";
import { toSkuDepth } from "./toSkuDepth";

export type SidePanelSkuInput = {
  /** Side-panel groove type: "NoG" | "UpperG" | "CenterG" | "DoubleG" */
  panelType: string | null;
  /** Panel width in cm (fixed ~1 cm for standard side panels) */
  width: number | null;
  /** Cabinet height in cm */
  height: number | null;
  /** Cabinet depth in cm */
  depth: number | null;
  /** Cabinet material SKU (e.g. "HPL", "LACM", "3D") */
  materialSku?: string | null;
  /** Cabinet color code (e.g. "37", "A6", "FE") */
  colorCode?: string | null;
};

const FALLBACK = "X";
const CATEGORY = "VAN";
const SERIES = "URSP";

/** Side-panel groove type → pricing code for the URSP SKU */
const sidePanelPricingMap: Record<string, string> = {
  NoG: "0G",
  UpperG: "1GU",
  CenterG: "1GC",
  DoubleG: "2G",
};

/** Default physical width of a side panel in cm */
export const SIDE_PANEL_WIDTH_CM = 1;

/**
 * Builds a pricing SKU for a side-panel accessory (Resolver 4).
 *
 * Dimensions are converted from cm → inches.
 *
 * Example: VAN-URSP-1GU-.4W-20.9H-19.7D-LACG-37
 * (1cm wide, 53cm tall, 50cm deep, LACG material, color code 37)
 */
export function buildSidePanelSku(input: SidePanelSkuInput): string | null {
  if (!input.panelType || input.panelType === "None") return null;

  const code = sidePanelPricingMap[input.panelType] ?? FALLBACK;

  const w = input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${cmToInches(input.height)}H` : `${FALLBACK}H`;
  // Side-panel canvas depth map: canvas value → nominal cm before inches conversion
  const SIDE_PANEL_DEPTH_MAP: Record<number, number> = { 46: 45.5 };
  const normalizedDepth = input.depth != null
    ? (SIDE_PANEL_DEPTH_MAP[input.depth] ?? toSkuDepth(input.depth))
    : null;
  const d = normalizedDepth != null ? `${cmToInches(normalizedDepth)}D` : `${FALLBACK}D`;

  const mat = input.materialSku?.trim() || null;
  const color = input.colorCode?.trim() || null;
  const matSuffix = mat ? (color ? `-${mat}-${color}` : `-${mat}`) : "";

  return `${CATEGORY}-${SERIES}-${code}-${w}-${h}-${d}${matSuffix}`;
}
