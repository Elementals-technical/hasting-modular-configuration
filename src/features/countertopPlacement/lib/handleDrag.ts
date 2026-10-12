import { COUNTERTOP_RESIZE_STEP_M } from "@/features/configuratorApi";

/**
 * Framework-free drag controller for the countertop resize handles.
 *
 * A session starts on pointerdown; pointer moves are throttled with requestAnimationFrame and
 * converted to overlay-frame coordinates (`client - origin()`). At most one `lengthAtPointer`
 * request is in flight (latest wins: when it settles, the newest pending point is requested next).
 * `end()` waits for the in-flight request, commits the last previewed length when it changed and
 * clears the preview; `cancel()` clears the preview without committing.
 */

export type CountertopResizeSide = "left" | "right";
export type CountertopLengthPreview = { side: CountertopResizeSide; lengthM: number };
export type CountertopLengthAtPointer = {
  lengthM: number;
  rawLengthM: number;
  snappedTo: { kind: string; xM: number } | null;
  limits: { minLengthM: number; maxLengthM: number };
};

type Point = { x: number; y: number };

export type HandleDragSessionOptions = {
  side: CountertopResizeSide;
  startLengthM: number;
  origin(): { left: number; top: number };
  lengthAtPointer(
    side: CountertopResizeSide,
    point: Point,
  ): Promise<CountertopLengthAtPointer | null> | CountertopLengthAtPointer | null;
  onPreview(preview: CountertopLengthPreview | null): void;
  onCommit(side: CountertopResizeSide, lengthM: number): void;
  /** Every accepted (non-null) result, e.g. for a tooltip. */
  onResult?(result: CountertopLengthAtPointer): void;
  /** Called once when the session is over (committed, ended without change or cancelled). */
  onFinish?(): void;
  requestFrame?(callback: () => void): number;
  cancelFrame?(id: number): void;
};

export type HandleDragSession = {
  readonly side: CountertopResizeSide;
  move(client: Point): void;
  /** Pointer released: settle pending work, commit if changed, clear the preview. */
  end(): Promise<void>;
  /** Pointer cancelled / Escape / unmount: clear the preview, never commit. */
  cancel(): void;
  isDone(): boolean;
};

/** Minimum change (m) that counts as a real resize. */
export const LENGTH_EPSILON_M = 1e-6;
/** Shift + Arrow nudges this many resize steps (10 × 0.1″ = 1″). */
export const NUDGE_SHIFT_STEPS = 10;

const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
  !!value && typeof (value as { then?: unknown }).then === "function";

const defaultRequestFrame = (callback: () => void): number => {
  if (typeof globalThis.requestAnimationFrame === "function") return globalThis.requestAnimationFrame(callback);
  return setTimeout(callback, 16) as unknown as number;
};
const defaultCancelFrame = (id: number) => {
  if (typeof globalThis.cancelAnimationFrame === "function") globalThis.cancelAnimationFrame(id);
  else clearTimeout(id);
};

export function createHandleDragSession(options: HandleDragSessionOptions): HandleDragSession {
  const { side, startLengthM } = options;
  const requestFrame = options.requestFrame ?? defaultRequestFrame;
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame;

  let state: "active" | "ending" | "done" = "active";
  let pendingPoint: Point | null = null;
  let frameId = 0;
  let inFlight: Promise<void> | null = null;
  let lastLengthM: number | null = null;

  const accept = (result: CountertopLengthAtPointer | null) => {
    if (state === "done" || !result || !Number.isFinite(result.lengthM)) return;
    lastLengthM = result.lengthM;
    options.onPreview({ side, lengthM: result.lengthM });
    options.onResult?.(result);
  };

  const run = () => {
    const client = pendingPoint;
    pendingPoint = null;
    if (!client || state === "done") return;
    const origin = options.origin();
    const point = { x: client.x - origin.left, y: client.y - origin.top };
    let out: ReturnType<HandleDragSessionOptions["lengthAtPointer"]>;
    try {
      out = options.lengthAtPointer(side, point);
    } catch {
      out = null;
    }
    if (!isThenable<CountertopLengthAtPointer | null>(out)) {
      accept(out);
      return;
    }
    inFlight = Promise.resolve(out)
      .then(
        (result) => result,
        () => null,
      )
      .then((result) => {
        inFlight = null;
        accept(result);
        if (state === "active" && pendingPoint) run();
      });
  };

  const flush = () => {
    frameId = 0;
    if (state !== "active" || inFlight || !pendingPoint) return;
    run();
  };

  const stopFrame = () => {
    if (frameId) cancelFrame(frameId);
    frameId = 0;
  };

  const finish = () => {
    state = "done";
    stopFrame();
    pendingPoint = null;
    options.onPreview(null);
    options.onFinish?.();
  };

  return {
    side,
    move(client) {
      if (state !== "active") return;
      pendingPoint = { x: client.x, y: client.y };
      if (!frameId && !inFlight) frameId = requestFrame(flush);
    },
    async end() {
      if (state !== "active") return;
      state = "ending";
      stopFrame();
      while (state === "ending") {
        if (inFlight) await inFlight;
        else if (pendingPoint) run();
        else break;
      }
      if (state !== "ending") return; // cancelled while settling
      if (lastLengthM !== null && Math.abs(lastLengthM - startLengthM) > LENGTH_EPSILON_M) {
        try {
          options.onCommit(side, lastLengthM);
        } finally {
          finish();
        }
        return;
      }
      finish();
    },
    cancel() {
      if (state === "done") return;
      finish();
    },
    isDone: () => state === "done",
  };
}

type PointerLike = { pointerId?: number; clientX: number; clientY: number };

/**
 * Wires a session to window-level pointer / key events. Returns an idempotent detach.
 * Events of other pointers are ignored when `pointerId` is known.
 */
export function bindHandleDragEvents(
  session: HandleDragSession,
  { target = window as unknown as EventTarget, pointerId }: { target?: EventTarget; pointerId?: number } = {},
): () => void {
  const matches = (event: PointerLike) =>
    pointerId === undefined || event.pointerId === undefined || event.pointerId === pointerId;
  const move = (event: Event) => {
    const e = event as unknown as PointerLike;
    if (matches(e)) session.move({ x: e.clientX, y: e.clientY });
  };
  const up = (event: Event) => {
    if (!matches(event as unknown as PointerLike)) return;
    detach();
    void session.end();
  };
  const cancel = (event: Event) => {
    if (!matches(event as unknown as PointerLike)) return;
    detach();
    session.cancel();
  };
  const key = (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    event.preventDefault();
    detach();
    session.cancel();
  };
  let attached = true;
  const detach = () => {
    if (!attached) return;
    attached = false;
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", cancel);
    target.removeEventListener("keydown", key);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", cancel);
  target.addEventListener("keydown", key);
  return detach;
}

/**
 * Keyboard nudge for a focused handle: the key pointing away from the countertop grows it
 * (ArrowRight on the right end, ArrowLeft on the left end). One `COUNTERTOP_RESIZE_STEP_M` (0.1″),
 * Shift = `NUDGE_SHIFT_STEPS` steps. Clamped to `limits` when given. Returns null for other keys or
 * when nothing would change.
 */
export function nudgeLengthM({
  side,
  key,
  shiftKey,
  lengthM,
  limits,
}: {
  side: CountertopResizeSide;
  key: string;
  shiftKey: boolean;
  lengthM: number;
  limits?: { minLengthM: number; maxLengthM: number } | null;
}): number | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const outward = side === "right" ? "ArrowRight" : "ArrowLeft";
  const step = COUNTERTOP_RESIZE_STEP_M * (shiftKey ? NUDGE_SHIFT_STEPS : 1);
  let next = lengthM + (key === outward ? step : -step);
  if (limits) next = Math.min(Math.max(next, limits.minLengthM), limits.maxLengthM);
  return Math.abs(next - lengthM) > LENGTH_EPSILON_M ? next : null;
}
