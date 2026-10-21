import type { CountertopOverlayFrame, PlacementOverlayPoint } from "@/features/configuratorApi";

import { overlaps, within } from "./screenGeometry";
import type { ScreenBox, Size } from "./screenGeometry";

/**
 * The length hint's box. Its text is fixed and stays on one line (12 px on a 16 px line, 4 × 10 px
 * padding): 234 × 24 px rendered, widened so the viewport clamp and the overlap check stay on the safe
 * side without measuring the DOM.
 */
export const LENGTH_HINT_SIZE_PX: Size = { width: 240, height: 24 };
/** One line of the reason text at its max width, until the rendered text has been measured. */
export const REASON_FALLBACK_SIZE_PX: Size = { width: 260, height: 24 };
/** Between the hint and what it stands under. */
const GAP_PX = 8;
/** Kept clear of the viewport's edges. */
const EDGE_PX = 8;
/** Half the move marker (a 29 px icon centred on `center`): it sticks out under a thin top. */
export const MOVE_MARKER_HALF_PX = 15;
/** "Apply" at 12 px with 12 px side padding, rounded up; 16 px line with 3 px padding. */
const APPLY_SIZE_PX: Size = { width: 60, height: 22 };
const DISCARD_SIZE_PX = 22;

const boxAround = (points: readonly PlacementOverlayPoint[]): ScreenBox | null =>
  points.length > 0
    ? {
        left: Math.min(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        right: Math.max(...points.map((point) => point.x)),
        bottom: Math.max(...points.map((point) => point.y)),
      }
    : null;

/**
 * Where Apply, × and the reason text are drawn from the action anchor: Apply and the reason are
 * right-aligned at their point (`translateX(-100%)`), × starts at its point.
 */
export const actionRowPositions = (action: PlacementOverlayPoint) => ({
  apply: { x: action.x - 3, y: action.y + 5 },
  discard: { x: action.x + 3, y: action.y + 3 },
  reason: { x: action.x + 25, y: action.y + 34 },
});

/** The box Apply and × take, with the reason text under them when it is shown. */
export const actionRowBox = (action: PlacementOverlayPoint, reason: Size | null): ScreenBox => {
  const { apply, discard, reason: reasonCorner } = actionRowPositions(action);
  const row = {
    left: apply.x - APPLY_SIZE_PX.width,
    top: Math.min(apply.y, discard.y),
    right: discard.x + DISCARD_SIZE_PX,
    bottom: Math.max(apply.y + APPLY_SIZE_PX.height, discard.y + DISCARD_SIZE_PX),
  };
  if (!reason) return row;
  return {
    left: Math.min(row.left, reasonCorner.x - reason.width),
    top: row.top,
    right: Math.max(row.right, reasonCorner.x),
    bottom: Math.max(row.bottom, reasonCorner.y + reason.height),
  };
};

/** The top's box on screen: the published `bounds`, else the hull's, else the anchor points'. */
export const countertopScreenBox = (frame: CountertopOverlayFrame): ScreenBox | null =>
  frame.bounds ??
  boxAround(frame.hull) ??
  boxAround(Object.values(frame.points ?? {}).filter((point) => point !== undefined));

type LengthHintInput = {
  top: ScreenBox;
  /** The move marker's centre, when it is drawn. */
  marker: PlacementOverlayPoint | null;
  /** Apply, × and the reason text, when they are drawn. */
  actionRow: ScreenBox | null;
  viewport: Size | null;
};

/**
 * Where the length hint goes, in iframe px (`x` its centre, `y` its top edge): centred on the top,
 * under its lower edge and the move marker; below the Apply / × row when it would overlap the row
 * there; left of the row, at the same height, when the viewport has no room below the row. Always
 * inside the viewport.
 */
export const placeLengthHint = ({ top, marker, actionRow, viewport }: LengthHintInput): PlacementOverlayPoint => {
  const { width, height } = LENGTH_HINT_SIZE_PX;
  const viewportWidth = viewport?.width || Infinity;
  const viewportHeight = viewport?.height || Infinity;
  const clampX = (x: number) => within(x, EDGE_PX + width / 2, viewportWidth - EDGE_PX - width / 2);
  const isClear = (x: number, y: number) =>
    !actionRow || !overlaps({ left: x - width / 2, top: y, right: x + width / 2, bottom: y + height }, actionRow);

  const x = clampX((top.left + top.right) / 2);
  const lowerEdge = Math.max(top.bottom, marker ? marker.y + MOVE_MARKER_HALF_PX : -Infinity);
  const under = within(lowerEdge + GAP_PX, EDGE_PX, viewportHeight - EDGE_PX - height);
  if (!actionRow || isClear(x, under)) return { x, y: under };
  const belowRow = actionRow.bottom + GAP_PX;
  if (belowRow + height <= viewportHeight - EDGE_PX) return { x, y: belowRow };
  return { x: clampX(actionRow.left - GAP_PX - width / 2), y: under };
};
