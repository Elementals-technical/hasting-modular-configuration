import { useMemo } from "react";

import { useCountertopLength } from "./useCountertopLength";
import { useMaxCountertopLength } from "./useMaxCountertopLength";

const EPSILON_CM = 0.01;

export type CountertopLengthGuard = {
  /** Resolved max from countertop rules. null when no rule (e.g. plain style). */
  max: number | null;
  /**
   * Current countertop length including any active side panels (`useCountertopLength`): on a
   * multi-level composition the run the countertop covers, not the cabinets under cabinet covers.
   */
  currentWithSp: number | null;
  /** The same length without the side-panel offset. Use as baseline for SP-toggle math. */
  currentCabinetOnly: number | null;
  /** max − currentWithSp. null if either is null. */
  remaining: number | null;
  /**
   * True if adding `deltaCm` to the current SP-inclusive total would not exceed max.
   * Use for: cabinet add (delta=newWidth), duplicate (delta=cabinetWidth),
   * resize (delta=newWidth − currentCabinetWidth).
   * Returns true when guard cannot be evaluated (max or current is null) — preserves
   * the existing "permissive when unknown" behavior across consumers.
   */
  canAccommodate: (deltaCm: number) => boolean;
  /**
   * True if the given absolute total (cm) fits within max.
   * Use when caller already computed the projected total, e.g. SP toggle
   * where the delta depends on the chosen side(s) and the current per-side status.
   * Returns true when max is null.
   */
  canAccommodateTotal: (totalCm: number) => boolean;
};

/**
 * Centralized guard for max-countertop-length checks across all 4 enforcement
 * paths: cabinet add, resize, duplicate, side-panel toggle.
 *
 * `fallbackWidth` is used while PlayCanvas polling is warming up so callers
 * that previously passed `selectedDimensions.width ?? null` to the underlying
 * scene hooks keep the same not-too-permissive behavior.
 */
export const useCountertopLengthGuard = (
  productIds: string[],
  fallbackWidth: number | null = null,
): CountertopLengthGuard => {
  const max = useMaxCountertopLength();
  const { withSidePanels: currentWithSp, cabinetsOnly: currentCabinetOnly } = useCountertopLength(
    productIds,
    fallbackWidth,
  );

  return useMemo(() => {
    const remaining = max !== null && currentWithSp !== null ? max - currentWithSp : null;

    const canAccommodate = (deltaCm: number): boolean => {
      if (max === null || currentWithSp === null) return true;
      return currentWithSp + deltaCm <= max + EPSILON_CM;
    };

    const canAccommodateTotal = (totalCm: number): boolean => {
      if (max === null) return true;
      return totalCm <= max + EPSILON_CM;
    };

    return { max, currentWithSp, currentCabinetOnly, remaining, canAccommodate, canAccommodateTotal };
  }, [max, currentWithSp, currentCabinetOnly]);
};
