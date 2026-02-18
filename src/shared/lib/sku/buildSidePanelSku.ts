// import { cmToInches } from "./cmToInches";

export type SidePanelSkuInput = {
  /** Side-panel groove type: "NoG" | "UpperG" | "CenterG" | "DoubleG" */
  panelType: string | null;
  /** Panel width in cm (fixed ~1 cm for standard side panels) */
  width: number | null;
  /** Cabinet height in cm */
  height: number | null;
  /** Cabinet depth in cm */
  depth: number | null;
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
 * Example: VAN-URSP-0G-.4W-19.7H-17.9D
 */
export function buildSidePanelSku(input: SidePanelSkuInput): string | null {
  if (!input.panelType || input.panelType === "None") return null;

  const code = sidePanelPricingMap[input.panelType] ?? FALLBACK;

  // TODO: uncomment cmToInches when backend switches to inches
  // const w = input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  // const h = input.height != null ? `${cmToInches(input.height)}H` : `${FALLBACK}H`;
  // const d = input.depth != null ? `${cmToInches(input.depth)}D` : `${FALLBACK}D`;
  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${input.height}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  return `${CATEGORY}-${SERIES}-${code}-${w}-${h}-${d}`;
}
