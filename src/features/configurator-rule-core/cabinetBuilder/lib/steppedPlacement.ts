/**
 * Where a cabinet goes when its plus button stands on the outer side of a short cabinet.
 *
 * A short cabinet (`ruleData.steppedModules`, placement "composition-end") stands at an end of the
 * composition, beside the taller cabinets. The scene shows a plus button on each side of every
 * cabinet, so one of them would put a taller cabinet outside the short one and leave the short one
 * between taller cabinets. Such a cabinet goes on the inner side of the short one instead: the
 * short one stays at the end. A cabinet that itself stands at an end (another short one, an open
 * side shelf) goes where it was asked to; which of them is outermost is a question to the client.
 */
export const resolveSteppedEndPlacement = ({
  anchorRuntimeId,
  side,
  orderedRuntimeIds,
  steppedRuntimeIds,
  addsEndCabinet,
}: {
  anchorRuntimeId: string;
  side: "left" | "right";
  /** The placed cabinets from left to right. */
  orderedRuntimeIds: readonly string[];
  steppedRuntimeIds: readonly string[];
  /** Whether the cabinet being added stands at an end itself (a short one, an open side shelf). */
  addsEndCabinet: boolean;
}): { anchorRuntimeId: string; side: "left" | "right" } => {
  if (addsEndCabinet || !steppedRuntimeIds.includes(anchorRuntimeId)) return { anchorRuntimeId, side };

  const index = orderedRuntimeIds.indexOf(anchorRuntimeId);
  const isOuterSide = (side === "left" && index === 0) || (side === "right" && index === orderedRuntimeIds.length - 1);
  if (index === -1 || !isOuterSide) return { anchorRuntimeId, side };

  return { anchorRuntimeId, side: side === "left" ? "right" : "left" };
};

/** Two placed cabinets to swap, by runtime id. */
export type CabinetSwap = readonly [runtimeIdA: string, runtimeIdB: string];

/**
 * The swaps a "Move Left" / "Move Right" of a placed cabinet makes, in order.
 *
 * A move swaps the cabinet with its neighbour. A short cabinet (`ruleData.steppedModules`) moved
 * towards the tall ones would then stand between them, which the scene refuses
 * (UF_HEIGHT_RUN_VIOLATION). It jumps the tall block instead and stands at its other end, the tall
 * cabinets keeping their order:
 * 1. it swaps with the block's far cabinet, so it is past the block;
 * 2. that far cabinet, now where the short one stood, swaps with each cabinet of the block in turn
 *    until it is back at the block's far end.
 * The tall cabinets stand together after every swap, so the scene takes each one.
 *
 * Examples (S short, T tall):
 * - S T1 T2 → right: [S, T2], [T2, T1] → T1 T2 S
 * - T1 T2 S → left: [S, T1], [T1, T2] → S T1 T2
 * - S1 S2 T1 → S1 right: [S1, S2] (beside another short cabinet: an ordinary swap)
 * - T1 T2 → T1 right: [T1, T2] (a tall cabinet: an ordinary swap)
 * Empty when there is nothing on that side, or the cabinet is not in the row.
 */
export const resolveMoveSwaps = ({
  runtimeId,
  direction,
  orderedRuntimeIds,
  steppedRuntimeIds,
}: {
  runtimeId: string;
  direction: "left" | "right";
  /** The placed cabinets from left to right. */
  orderedRuntimeIds: readonly string[];
  steppedRuntimeIds: readonly string[];
}): CabinetSwap[] => {
  const step = direction === "left" ? -1 : 1;
  const index = orderedRuntimeIds.indexOf(runtimeId);
  const isInRow = (position: number) => position >= 0 && position < orderedRuntimeIds.length;
  const isShort = (position: number) => steppedRuntimeIds.includes(orderedRuntimeIds[position]);

  // The cabinet is at that end of the row (or not in it): nothing to swap with.
  if (index === -1 || !isInRow(index + step)) return [];

  // A tall cabinet, or a short one beside another short one, swaps with its neighbour.
  const neighbour = orderedRuntimeIds[index + step];
  if (!isShort(index) || isShort(index + step)) return [[runtimeId, neighbour]];

  // A short cabinet facing the tall block: the block runs from the neighbour to its far cabinet.
  const block: string[] = [];
  for (let position = index + step; isInRow(position) && !isShort(position); position += step) {
    block.push(orderedRuntimeIds[position]);
  }
  const farCabinet = block[block.length - 1];
  const betweenCabinets = block.slice(0, -1);

  return [[runtimeId, farCabinet], ...betweenCabinets.map((tall): CabinetSwap => [farCabinet, tall])];
};
