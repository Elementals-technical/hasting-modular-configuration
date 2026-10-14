/**
 * The scene's cabinets state lists the cabinets in the order they were placed, a Drag & Drop add
 * last wherever it stands. The composition runs along the wall: the scene's composition order,
 * which the prices, the summary and the side of an open side shelf follow. The cabinets keep the
 * state's order when that order does not name them all.
 */
export const inCompositionOrder = <T extends { id: string }>(cabinets: readonly T[], order: readonly string[]): T[] => {
  const rank = new Map(order.map((id, index) => [id, index]));
  if (!cabinets.every(({ id }) => rank.has(id))) return [...cabinets];

  return [...cabinets].sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0));
};
