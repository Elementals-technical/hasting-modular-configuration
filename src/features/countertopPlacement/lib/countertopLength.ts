import type {
  CountertopLengthLimitsM,
  CountertopOverlayFrame,
  CountertopResizeSide,
  CountertopState,
} from "@/features/configuratorApi";

export const METRES_PER_INCH = 0.0254;
/** One 60 cm cabinet, in inches (≈ 23.622 in): the shortest countertop by default. */
export const ONE_CABINET_LENGTH_IN = 60 / 2.54;
/** Default length limits: one 60 cm cabinet (exactly 0.6 m once converted) to 120 in. */
export const DEFAULT_COUNTERTOP_LENGTH_LIMITS_IN = { min: ONE_CABINET_LENGTH_IN, max: 120 } as const;

export type LengthLimitsIn = { min: number; max: number };

/** The collection's `countertop.lengthLimitsIn` (ui.json), else one 60 cm cabinet (≈ 23.6 in) to 120 in. */
export const resolveCountertopLengthLimitsIn = (
  settings: { lengthLimitsIn?: LengthLimitsIn } | null | undefined,
): LengthLimitsIn => {
  const limits = settings?.lengthLimitsIn;
  return limits &&
    Number.isFinite(limits.min) &&
    Number.isFinite(limits.max) &&
    limits.min > 0 &&
    limits.max >= limits.min
    ? { min: limits.min, max: limits.max }
    : { ...DEFAULT_COUNTERTOP_LENGTH_LIMITS_IN };
};

export const limitsInToMetres = (limits: LengthLimitsIn): CountertopLengthLimitsM => ({
  minM: limits.min * METRES_PER_INCH,
  maxM: limits.max * METRES_PER_INCH,
});

/** Displayed inches: rounded to 0.1 (0.6 m -> 23.6, 1.2192 m -> 48). */
export const metresToDisplayInches = (metres: number) => Math.round((metres / METRES_PER_INCH) * 10) / 10;

/** `48″`, `23.6″`: at most one decimal, no trailing `.0`. */
export const formatInches = (inches: number) => `${Math.round(inches * 10) / 10}″`;

export const clampLength = (lengthM: number, limits: CountertopLengthLimitsM) =>
  Math.min(Math.max(lengthM, limits.minM), limits.maxM);

/**
 * Limits of a one-end resize from `getState().resizeBoundsM[side]` (phase-1 §6a): the source of truth
 * for the handles and the ghost. Null when the build does not publish them (callers fall back to the
 * overlay frame / collection limits).
 */
export const resizeBoundsLimitsM = (
  state: Pick<CountertopState, "resizeBoundsM"> | null | undefined,
  side: CountertopResizeSide,
): CountertopLengthLimitsM | null => {
  const bounds = state?.resizeBoundsM?.[side];
  return bounds && Number.isFinite(bounds.minLengthM) && Number.isFinite(bounds.maxLengthM)
    ? { minM: bounds.minLengthM, maxM: bounds.maxLengthM }
    : null;
};

type Point = { x: number; y: number };

/**
 * Screen px per metre along the countertop's length axis, as a vector (left -> right). Uses the
 * frame's `lengthAxisPx`; without it, derives it from the two end anchors and the length.
 */
export const lengthAxisOf = (
  frame: Pick<CountertopOverlayFrame, "lengthAxisPx" | "points" | "lengthM">,
): Point | null => {
  const axis = frame.lengthAxisPx;
  if (axis && Number.isFinite(axis.x) && Number.isFinite(axis.y) && Math.hypot(axis.x, axis.y) > 1e-6) return axis;
  const left = frame.points?.leftEnd;
  const right = frame.points?.rightEnd;
  if (!left || !right || !frame.lengthM || frame.lengthM <= 0) return null;
  const derived = { x: (right.x - left.x) / frame.lengthM, y: (right.y - left.y) / frame.lengthM };
  return Math.hypot(derived.x, derived.y) > 1e-6 ? derived : null;
};

/**
 * Length while a handle is dragged. Both ends move (symmetric resize), so the length changes by
 * twice the pointer travel along the axis; the left handle grows the countertop when it moves left.
 */
export const lengthFromHandleDrag = ({
  startLengthM,
  delta,
  axisPx,
  side,
  limits,
}: {
  startLengthM: number;
  delta: Point;
  axisPx: Point;
  side: "left" | "right";
  limits: CountertopLengthLimitsM;
}) => {
  const pxPerMetre = Math.hypot(axisPx.x, axisPx.y);
  const alongPx = (delta.x * axisPx.x + delta.y * axisPx.y) / pxPerMetre;
  const sign = side === "right" ? 1 : -1;
  return clampLength(startLengthM + (sign * 2 * alongPx) / pxPerMetre, limits);
};
