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
