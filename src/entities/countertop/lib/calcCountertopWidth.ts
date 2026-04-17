import { SIDE_PANEL_WIDTH_CM } from "@/shared/lib/sku";

/**
 * Calculates the total countertop width in centimeters,
 * including the +1 cm offset for each active side panel.
 *
 * Single source of truth — used by usePriceCalculation (pricing SKU + widthCm)
 * and both Summary pages (display SKU).
 *
 * @param cabinetWidthSum - sum of all cabinet widths in cm (presets + configs + fallback)
 * @param sidePanelLeft   - side panel left status from Redux ("active" | "inactive" | …)
 * @param sidePanelRight  - side panel right status from Redux
 * @returns total width in cm, or null if zero/empty
 */
export function calcTotalCountertopWidthCm(
  cabinetWidthSum: number,
  sidePanelLeft: string | null | undefined,
  sidePanelRight: string | null | undefined,
): number | null {
  const sidePanelOffset =
    (sidePanelLeft === "active" ? SIDE_PANEL_WIDTH_CM : 0) +
    (sidePanelRight === "active" ? SIDE_PANEL_WIDTH_CM : 0);

  return (cabinetWidthSum + sidePanelOffset) || null;
}
