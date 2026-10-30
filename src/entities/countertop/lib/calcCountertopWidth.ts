import type { ProductProfile } from "@/entities/collection/model/productProfile";
import { SIDE_PANEL_WIDTH_CM } from "@/shared/lib/sku";

/** Nominal width of a panel of the active collection. */
export const getSidePanelWidthCm = (profile: ProductProfile | null | undefined): number =>
  profile?.ruleData.sidePanels?.panelWidthCm ?? SIDE_PANEL_WIDTH_CM;

/** Counts only scene-reported active sides, never an assumed pair from a Yes/No choice. */
export const getActiveSidePanelCount = (left: string | null | undefined, right: string | null | undefined): number =>
  Number(left === "active") + Number(right === "active");

/**
 * Calculates the total countertop width in centimeters,
 * including the collection's nominal width for each active side panel.
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
  panelWidthCm = SIDE_PANEL_WIDTH_CM,
): number | null {
  const sidePanelOffset = getActiveSidePanelCount(sidePanelLeft, sidePanelRight) * panelWidthCm;

  return cabinetWidthSum + sidePanelOffset || null;
}
