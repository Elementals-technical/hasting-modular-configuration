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
  /** CAB — Cabinet body material SKU (e.g. "HPL", "LACM", "3D") */
  cabMaterialSku?: string | null;
  /** CAB — Cabinet body color code (e.g. "37", "A6", "FE") */
  cabColorCode?: string | null;
  /** HDL — Handle groove material SKU (e.g. "LACM", "3D") */
  hdlMaterialSku?: string | null;
  /** HDL — Handle groove color code (e.g. "DD", "90") */
  hdlColorCode?: string | null;
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
 * Example: VAN-URSP-1GU-.4W-20.9H-19.7D-CAB-LACM-90-HDL-LACM-DD
 * (1cm wide, 53cm tall, 50cm deep, cabinet LACM/90, handle groove LACM/DD)
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

  // CAB triplet — always (panel body painting)
  // HDL triplet — only for panels with grooves (UpperG, CenterG, DoubleG)
  const triplets: string[] = [];

  const cabMat = input.cabMaterialSku?.trim();
  const cabColor = input.cabColorCode?.trim();
  if (cabMat) triplets.push(cabColor ? `CAB-${cabMat}-${cabColor}` : `CAB-${cabMat}`);

  const hasGroove = input.panelType !== "NoG";
  if (hasGroove) {
    const hdlMat = input.hdlMaterialSku?.trim();
    const hdlColor = input.hdlColorCode?.trim();
    if (hdlMat) triplets.push(hdlColor ? `HDL-${hdlMat}-${hdlColor}` : `HDL-${hdlMat}`);
  }

  const elementsSuffix = triplets.length ? `-${triplets.join("-")}` : "";

  return `${CATEGORY}-${SERIES}-${code}-${w}-${h}-${d}${elementsSuffix}`;
}
