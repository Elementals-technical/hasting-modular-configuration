/**
 * The width a cabinet is added at: the chosen one where it is among the widths offered with room for it,
 * else the widest of those. A model opened in the builder keeps the width it was chosen at, which the room
 * left or the offered widths may no longer take.
 */
export const resolveAddedCabinetWidth = (
  selectedWidth: number | null,
  fittingWidths: readonly number[],
): number | null => {
  if (
    typeof selectedWidth === "number" &&
    Number.isFinite(selectedWidth) &&
    fittingWidths.some((width) => Math.abs(width - selectedWidth) < 0.01)
  )
    return selectedWidth;

  return fittingWidths.length > 0 ? Math.max(...fittingWidths) : null;
};
