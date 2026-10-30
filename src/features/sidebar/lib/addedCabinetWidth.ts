/**
 * The width a cabinet is added at: the chosen one where the composition has room for it, else the widest
 * it has room for. A model opened in the builder keeps the width it was chosen at, which the room left
 * may no longer take.
 */
export const resolveAddedCabinetWidth = (
  selectedWidth: number | null,
  fittingWidths: readonly number[],
  limitCm: number | null,
): number | null => {
  if (
    typeof selectedWidth === "number" &&
    Number.isFinite(selectedWidth) &&
    (limitCm === null || selectedWidth <= limitCm + 0.01)
  )
    return selectedWidth;

  return fittingWidths.length > 0 ? Math.max(...fittingWidths) : null;
};
