export type CountertopState = {
  readiness: string;
  productId: string | null;
  compositionId?: string | null;
  attached?: boolean;
  canResize?: boolean;
  offset?: { x: number; y: number };
  customLength?: number | null;
  autoLength?: number | null;
  size?: { length?: number | null; depth?: number | null };
  thickness?: number | null;
  dragEnabled?: boolean;
  dragging?: boolean;
  moving?: boolean;
};
export type CountertopEvent = { reason?: string; type?: string; state: CountertopState };
export type CountertopApi = {
  getState(): CountertopState | Promise<CountertopState>;
  setDragEnabled(enabled: boolean): unknown;
  setOffset(offset: { x: number; y: number }): unknown;
  resetOffset(): unknown;
  setSize(size: { length: number | null }): unknown;
  /** Newer builds only: resize a moved-off top from one end, the other end fixed, clamped. */
  resizeFrom?(side: "left" | "right", lengthM: number): unknown;
  whenSettled(): CountertopState | Promise<CountertopState>;
  on(
    event: "change" | "action",
    callback: (event: CountertopEvent) => void,
    options?: { emitCurrent: boolean },
  ): () => void;
};

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
  if (original.attached) await api.resetOffset();
  else await api.setOffset({ ...original.offset });
  const positioned = await steps.settled();
  if (
    !positioned.offset ||
    !near(positioned.offset.x, original.offset.x) ||
    !near(positioned.offset.y, original.offset.y)
  ) {
    throw new Error("The original offset could not be restored exactly; the runtime constrained the position");
  }
  await api.setSize({ length: original.customLength });
  const restored = await steps.settled();
  if ((restored.customLength ?? null) !== original.customLength)
    throw new Error("The original custom length could not be restored");
  await api.setDragEnabled(original.dragEnabled);
  return steps.read();
};

export const countertopErrorMessage = (error: unknown) => {
  if (typeof error !== "object" || !error) return typeof error === "string" ? error : "Countertop command failed";
  const detail = error as { code?: unknown; message?: unknown };
  const message = typeof detail.message === "string" ? detail.message : "Countertop command failed";
  return detail.code ? `${String(detail.code)}: ${message}` : message;
};
