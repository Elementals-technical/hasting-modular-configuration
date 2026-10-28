const ascending = (a: number, b: number) => a - b;

/**
 * Presses or releases cell `k` of a column's draft. A cell that is pressed is always released; a new
 * one is refused (`blocked`, the draft unchanged) once `maxActive` cells are pressed. `next` is sorted.
 */
export const togglePosition = (
  draft: readonly number[],
  k: number,
  maxActive: number,
): { next: number[]; blocked: boolean } => {
  const sorted = [...draft].sort(ascending);

  if (sorted.includes(k)) return { next: sorted.filter((position) => position !== k), blocked: false };
  if (sorted.length >= maxActive) return { next: sorted, blocked: true };
  return { next: [...sorted, k].sort(ascending), blocked: false };
};
