import type { CountertopReasonSlug, CountertopState } from "./types";

/**
 * Countertop API semantics the UI shares (phase 1). The only place that names the runtime's error
 * codes and reason slugs; features import from here instead of spelling them.
 */

/**
 * Resize step: 0.1″ (client rules R15.3 / R16.4). Mirrors `COUNTERTOP_RESIZE_STEP_M` of the runtime
 * (`domain/countertop/countertop-resize-snap.mjs`), which `ConfiguratorAPI` does not expose yet.
 * `countertopOverlay.lengthAtPointer({ snap: true })` already applies it.
 */
export const COUNTERTOP_RESIZE_STEP_M = 0.0254 / 10;

/** The runtime puts a standard top `±2e-6` m off after its first one-end resize. */
export const COUNTERTOP_STANDARD_EPSILON_M = 1e-5;

export const COUNTERTOP_REASON_SLUGS: readonly CountertopReasonSlug[] = [
  "TRAP_KEEPOUT",
  "BASIN_EDGE_TOO_CLOSE",
  "SINK_BASE_NOT_COVERED",
  "SINK_LANDING_GAP",
  "SINK_LANDING_UNFIT",
  "COUNTERTOP_COLLISION",
  "COUNTERTOP_VERTICAL_LOCKED",
];

/** Standard = no custom length and no offset; `placementState` alone is not enough (see the step above). */
export const isStandardCountertop = (state: Pick<CountertopState, "customLength" | "offset"> | null | undefined) =>
  !!state &&
  (state.customLength ?? null) === null &&
  Math.abs(state.offset?.x ?? 0) < COUNTERTOP_STANDARD_EPSILON_M &&
  Math.abs(state.offset?.y ?? 0) < COUNTERTOP_STANDARD_EPSILON_M;

export type CountertopFailureKind =
  /** The pose broke a rule; the runtime already reverted it. `reasons` holds the slugs. */
  | "pose-invalid"
  /** A lift was requested in offset-only mode. */
  | "vertical-locked"
  /** No countertop bound yet. */
  | "not-ready"
  /** A legacy writer or a preset import holds the scene: retry later. */
  | "busy"
  /** `setSize(number)` on a standard top: use `resizeFrom`. */
  | "attached"
  /** Bad arguments: a UI bug. */
  | "invalid-input"
  | "unknown";

export type CountertopFailure = {
  kind: CountertopFailureKind;
  code: string | null;
  reasons: string[];
  message: string;
};

const KIND_BY_CODE: Record<string, CountertopFailureKind> = {
  COUNTERTOP_POSE_INVALID: "pose-invalid",
  COUNTERTOP_VERTICAL_LOCKED: "vertical-locked",
  COUNTERTOP_NOT_READY: "not-ready",
  // The countertop API was torn down (scene reload): the next binding will be ready again.
  COUNTERTOP_DESTROYED: "not-ready",
  COUNTERTOP_ATTACHED: "attached",
  COUNTERTOP_INVALID_INPUT: "invalid-input",
  LEGACY_WRITERS_BUSY: "busy",
};

/** Any rejection of a `ConfiguratorAPI.countertop` mutator, as one shape. */
export const classifyCountertopError = (error: unknown): CountertopFailure => {
  const detail = (typeof error === "object" && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
    reasons?: unknown;
  };
  const code = typeof detail.code === "string" ? detail.code : null;
  const reasons = Array.isArray(detail.reasons) ? detail.reasons.filter((r): r is string => typeof r === "string") : [];
  const message =
    typeof detail.message === "string" ? detail.message : typeof error === "string" ? error : "Countertop command failed";
  // The composition's own guards (COMPOSITION_BUSY, teardown during a preset import) also mean "later".
  const kind = code ? (KIND_BY_CODE[code] ?? (/BUSY$|TEARDOWN/.test(code) ? "busy" : "unknown")) : "unknown";
  return { kind, code, reasons, message };
};
