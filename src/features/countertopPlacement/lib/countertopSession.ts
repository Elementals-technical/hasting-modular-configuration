import {
  classifyCountertopError,
  type CountertopApi,
  type CountertopFailure,
  type CountertopState,
  type CountertopValidation,
} from "@/features/configuratorApi";
import { resolveUiReasonText, type ReasonTextResolver } from "@/shared/lib/reasonText";

/** The one countertop contract lives in `configuratorApi`; re-exported for the feature's existing imports. */
export type { CountertopAction, CountertopApi, CountertopEvent, CountertopState } from "@/features/configuratorApi";

/** What Cancel restores: the countertop's placement before an edit session started. */
export type CountertopSnapshot = {
  productId: string;
  compositionId: string;
  offset: { x: number; y: number };
  attached: boolean;
  customLength: number | null;
  dragEnabled: boolean;
};

export const sameCountertopTarget = (
  state: CountertopState,
  original: Pick<CountertopSnapshot, "productId" | "compositionId">,
) => state.productId === original.productId && state.compositionId === original.compositionId;

/** Null while the countertop cannot be edited (not ready, or no product / composition). */
export const captureCountertopSnapshot = (state: CountertopState): CountertopSnapshot | null =>
  state.readiness === "ready" && state.productId && state.compositionId
    ? {
        productId: state.productId,
        compositionId: state.compositionId,
        offset: { x: state.offset?.x ?? 0, y: state.offset?.y ?? 0 },
        attached: state.attached === true,
        customLength: state.customLength ?? null,
        dragEnabled: state.dragEnabled === true,
      }
    : null;

const near = (left: number, right: number) => Math.abs(left - right) < 1e-6;

export type CountertopRestoreSteps = {
  /** Reads the state and throws when the target changed (the caller's guard). */
  read(): Promise<CountertopState>;
  /** Waits for the runtime to settle, then `read`s. */
  settled(): Promise<CountertopState>;
};

/**
 * Cancel: puts the offset (or the attached position) and the custom length back, then the drag
 * flag. Every step is verified; a runtime that constrained the value makes this throw.
 */
export const restoreCountertopSnapshot = async (
  api: CountertopApi,
  original: CountertopSnapshot,
  steps: CountertopRestoreSteps,
) => {
  await api.setDragEnabled(false);
  await steps.read();
  // `skip`: Cancel returns to the pose the session started from, a known pose. Under `guard` the
  // runtime could reject it (POSE_INVALID) when the scene changed meanwhile, or when that pose was
  // already invalid (a restored preset), and Cancel would leave the edited pose in place. The exact
  // check below still catches a runtime that constrained it; VERTICAL_LOCKED is not bypassed.
  let target = original.offset;
  if (original.attached) await api.resetOffset();
  else {
    try {
      await api.setOffset({ ...target }, { validation: "skip" });
    } catch (error) {
      if (classifyCountertopError(error).kind !== "vertical-locked") throw error;
      // The top got locked meanwhile (now 4″): it cannot return to a lifted pose, so Cancel lowers it.
      target = { x: original.offset.x, y: 0 };
      await api.setOffset({ ...target }, { validation: "skip" });
    }
  }
  const positioned = await steps.settled();
  if (!positioned.offset || !near(positioned.offset.x, target.x) || !near(positioned.offset.y, target.y)) {
    throw new Error("The original offset could not be restored exactly; the runtime constrained the position");
  }
  await api.setSize({ length: original.customLength });
  const restored = await steps.settled();
  if ((restored.customLength ?? null) !== original.customLength)
    throw new Error("The original custom length could not be restored");
  await api.setDragEnabled(original.dragEnabled);
  return steps.read();
};

export const COUNTERTOP_NOT_READY_TEXT = "The countertop is not ready yet.";
export const COUNTERTOP_BUSY_TEXT = "The scene is busy. Try again in a moment.";
export const COUNTERTOP_FAILED_TEXT = "The countertop could not be changed.";
const POSE_INVALID_FALLBACK = "This countertop position is not allowed.";

export type CountertopErrorDescription = CountertopFailure & {
  /** User-facing sentences: one per reason for `pose-invalid`, otherwise one. */
  lines: string[];
};

const reasonTexts = (slugs: readonly string[], resolveText: ReasonTextResolver) =>
  slugs.map((code) => resolveText({ code }) ?? code).filter((text, i, all) => text && all.indexOf(text) === i);

/**
 * The one description of a failed countertop command (a `ConfiguratorAPI.countertop` mutator or a
 * UI guard around it). Outside `pose-invalid` the runtime has already reverted the scene; the UI only
 * reports. `resolveText` is the component's `useReasonText()`; slugs fall back to the UI dictionary.
 */
export const describeCountertopError = (
  error: unknown,
  resolveText: ReasonTextResolver = resolveUiReasonText,
): CountertopErrorDescription => {
  const failure = classifyCountertopError(error);
  const lines = (() => {
    switch (failure.kind) {
      case "pose-invalid": {
        const texts = reasonTexts(failure.reasons, resolveText);
        return texts.length ? texts : [POSE_INVALID_FALLBACK];
      }
      case "vertical-locked":
        return [resolveText({ code: "COUNTERTOP_VERTICAL_LOCKED", text: failure.message }) ?? failure.message];
      case "not-ready":
        return [COUNTERTOP_NOT_READY_TEXT];
      case "busy":
        return [COUNTERTOP_BUSY_TEXT];
      case "invalid-input":
      case "attached":
        // A UI bug, not a user error (spec §4): log the details, show a generic text.
        console.error("Countertop command rejected", error);
        return [COUNTERTOP_FAILED_TEXT];
      default:
        // UI guards (plain Error) and codes the contract does not name keep their detail.
        return [failure.code ? `${failure.code}: ${failure.message}` : failure.message];
    }
  })();
  return { ...failure, lines };
};

/** `describeCountertopError` as one string, for the inline `role="alert"` line. */
export const countertopErrorMessage = (error: unknown, resolveText: ReasonTextResolver = resolveUiReasonText) =>
  describeCountertopError(error, resolveText).lines.join(" ");

export type CountertopValidationNote = { tone: "invalid" | "warning"; lines: string[] } | null;

/**
 * The live verdict of the pose (`state.validation`) for the D&D UI: `invalid` is red with the reasons,
 * warnings (`COUNTERTOP_COLLISION`) are an amber hint that does not block, `unknown` shows nothing.
 */
export const describeCountertopValidation = (
  validation: CountertopValidation | null | undefined,
  resolveText: ReasonTextResolver = resolveUiReasonText,
): CountertopValidationNote => {
  if (!validation) return null;
  if (validation.status === "invalid") {
    const lines = reasonTexts(validation.reasons ?? [], resolveText);
    return { tone: "invalid", lines: lines.length ? lines : [POSE_INVALID_FALLBACK] };
  }
  if (validation.status === "unknown" || !validation.warnings?.length) return null;
  return { tone: "warning", lines: reasonTexts(validation.warnings, resolveText) };
};
