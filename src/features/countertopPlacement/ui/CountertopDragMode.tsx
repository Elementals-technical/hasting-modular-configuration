import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import clsx from "clsx";

import {
  createConfiguratorBridge,
  isStandardCountertop,
  type ConfiguratorBridge,
  type CountertopLengthAtPointer,
  type CountertopLengthPreview,
  type CountertopResizeSide,
  type PlacementOverlayPoint,
} from "@/features/configuratorApi";
import { useCountertopRuntimeState } from "@/shared/hooks/useCountertopRuntimeState";
import { getCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import { useReasonText } from "@/shared/lib/reasonText";

import { getCountertopLayoutIntroSeen, setCountertopLayoutIntroSeen } from "../lib/countertopLayoutIntroStorage";
import { clampLength, limitsInToMetres, resizeBoundsLimitsM, type LengthLimitsIn } from "../lib/countertopLength";
import { createCountertopOverlayStore } from "../lib/countertopOverlayStore";
import {
  captureCountertopSnapshot,
  countertopErrorMessage,
  describeCountertopValidation,
  restoreCountertopSnapshot,
  sameCountertopTarget,
  type CountertopApi,
  type CountertopSnapshot,
  type CountertopState,
} from "../lib/countertopSession";
import { commitHostedSinkLanding } from "../lib/hostedSinkLanding";
import { CountertopDragOverlay } from "./CountertopDragOverlay";
import { CountertopLayoutIntroModal } from "./CountertopLayoutIntroModal";

import s from "./CountertopDragMode.module.scss";

export type CountertopOverlayBridge = Pick<
  ConfiguratorBridge,
  | "subscribeCountertopOverlay"
  | "setCountertopOverlayActive"
  | "setCountertopOverlayPlaceholders"
  | "setCountertopLengthLimits"
  | "previewCountertopLength"
  | "countertopLengthAtPointer"
  | "resizeCountertopFrom"
>;
/** `apply` also ends a session from outside (a committed sink move replaces the composition under it). */
export type CountertopDragModeHandle = { enter(): void; standard(): void; apply(): void };
export type CountertopDragStatus = { supported: boolean; available: boolean; active: boolean; busy: boolean };

type Props = {
  ready: boolean;
  /** Another editor (cabinet Drag & Drop, the test-mode modal) is busy. */
  disabled: boolean;
  getApi: () => CountertopApi | null;
  lengthLimitsIn: LengthLimitsIn;
  createBridge?: () => CountertopOverlayBridge;
  onStatusChange?: (status: CountertopDragStatus) => void;
  onCommitted?: (state: CountertopState) => void | Promise<void>;
  onSelect?: (productId: string) => void;
};

type Session = {
  api: CountertopApi;
  snapshot: CountertopSnapshot;
  bridge: CountertopOverlayBridge;
  stopOverlay: (() => void) | null;
  overlay: boolean;
};

/** A length command: `send` runs it, `clearPreview` drops the ghost preview once it settles. */
type LengthRequest = { send: () => unknown; clearPreview: boolean };
/** Single-flight, latest-wins queue: one command in flight, only the newest request waits. */
type LengthQueue = { current: Promise<void> | null; next: LengthRequest | null };

const quiet = <T,>(promise: Promise<T> | undefined, fallback: T) =>
  (promise ?? Promise.resolve(fallback)).catch(() => fallback);

/**
 * Countertop Drag & Drop mode: the before-state is captured on enter; Apply keeps the live edits
 * (drag off, settle, sync), Cancel / × restores the captured offset and length. PlayCanvas tints
 * the countertop and publishes the anchors; without `countertopOverlay` (older builds) Apply and
 * Cancel are pills in the top-right corner.
 */
export const CountertopDragMode = forwardRef<CountertopDragModeHandle, Props>(function CountertopDragMode(
  {
    ready,
    disabled,
    getApi,
    lengthLimitsIn,
    createBridge = createConfiguratorBridge,
    onStatusChange,
    onCommitted,
    onSelect,
  },
  ref,
) {
  const [store] = useState(createCountertopOverlayStore);
  const sessionRef = useRef<Session | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const lengthQueueRef = useRef<LengthQueue>({ current: null, next: null });
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonText = useReasonText();
  // Live verdict of the pose (change reason 'validation' arrives through the central store).
  const validation = describeCountertopValidation(useCountertopRuntimeState()?.validation, reasonText);
  const [isIntroOpen, setIsIntroOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setSupported(false);
    const discover = () => {
      if (!ready) return;
      attempts += 1;
      if (getApi()) setSupported(true);
      else if (attempts < 51) timer = setTimeout(discover, 300);
    };
    discover();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ready, getApi]);

  const available = ready && supported && !disabled && !pending && !active;
  useEffect(() => {
    onStatusChange?.({ supported: ready && supported, available, active, busy: active || pending });
  }, [ready, supported, available, active, pending, onStatusChange]);

  const teardown = useCallback(
    async (session: Session) => {
      session.stopOverlay?.();
      store.set(null);
      lengthQueueRef.current.next = null;
      if (session.overlay) {
        await quiet(session.bridge.previewCountertopLength?.(null), false);
        await quiet(session.bridge.setCountertopOverlayActive?.(false), false);
        await quiet(session.bridge.setCountertopOverlayPlaceholders?.(true), false);
      }
      if (sessionRef.current === session) sessionRef.current = null;
      if (mountedRef.current) {
        setActive(false);
        setOverlay(false);
      }
    },
    [store],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = sessionRef.current;
      if (session) {
        void Promise.resolve()
          .then(() => session.api.setDragEnabled(false))
          .catch(() => undefined)
          .then(() => teardown(session));
      }
    };
  }, [teardown]);

  const run = async (action: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      if (mountedRef.current) setError(countertopErrorMessage(failure, reasonText));
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  };

  const read = async (session: Session) => {
    const state = await session.api.getState();
    if (!sameCountertopTarget(state, session.snapshot))
      throw new Error("The countertop or composition changed; no command was sent to the new target");
    return state;
  };
  const settled = async (session: Session) => {
    await session.api.whenSettled();
    return read(session);
  };

  /** Drops the queued length and waits for the one in flight, so it cannot land after a restore. */
  const drainLength = async () => {
    lengthQueueRef.current.next = null;
    await lengthQueueRef.current.current;
  };

  const canEnter = () => available && !pendingRef.current && !sessionRef.current;

  const startSession = () => {
    void run(async () => {
      const api = getApi();
      if (!api) throw new Error("The countertop API is not available");
      const snapshot = captureCountertopSnapshot(await api.getState());
      if (!snapshot) throw new Error("The countertop is not ready");
      const session: Session = { api, snapshot, bridge: createBridge(), stopOverlay: null, overlay: false };
      sessionRef.current = session;
      setActive(true);
      try {
        await api.setDragEnabled(true);
        await quiet(session.bridge.setCountertopLengthLimits?.(limitsInToMetres(lengthLimitsIn)), false);
        session.stopOverlay = await quiet(
          session.bridge.subscribeCountertopOverlay?.((frame) => {
            if (sessionRef.current === session) store.set(frame);
          }),
          null,
        );
        if (session.stopOverlay) {
          session.overlay = await quiet(session.bridge.setCountertopOverlayActive?.(true), false);
          if (session.overlay) await quiet(session.bridge.setCountertopOverlayPlaceholders?.(false), false);
        }
        if (mountedRef.current) setOverlay(session.overlay);
        onSelect?.(snapshot.productId);
      } catch (failure) {
        await Promise.resolve()
          .then(() => api.setDragEnabled(snapshot.dragEnabled))
          .catch(() => undefined);
        await teardown(session);
        throw failure;
      }
    });
  };

  /** The layout intro precedes the first entry of the browser session; its Continue enters. */
  const enter = () => {
    if (!canEnter()) return;
    if (!getCountertopLayoutIntroSeen()) {
      setIsIntroOpen(true);
      return;
    }
    startSession();
  };

  // Enters past the flag, so a blocked storage cannot bounce the user back into the intro.
  const handleIntroContinue = () => {
    setCountertopLayoutIntroSeen();
    setIsIntroOpen(false);
    if (canEnter()) startSession();
  };

  const handleIntroClose = () => setIsIntroOpen(false);

  const apply = () => {
    const session = sessionRef.current;
    if (!session) return;
    void run(async () => {
      await drainLength();
      await read(session);
      await session.api.setDragEnabled(false);
      const next = await settled(session);
      if (await commitHostedSinkLanding(session.api)) return teardown(session);
      await onCommitted?.(next);
      await teardown(session);
    });
  };

  const cancel = () => {
    const session = sessionRef.current;
    if (!session) return;
    void run(async () => {
      await drainLength();
      await read(session);
      await restoreCountertopSnapshot(session.api, session.snapshot, {
        read: () => read(session),
        settled: () => settled(session),
      });
      await commitHostedSinkLanding(session.api);
      await teardown(session);
    });
  };

  const standard = () => {
    const session = sessionRef.current;
    if (!session && !available) return;
    void run(async () => {
      const api = session?.api ?? getApi();
      if (!api) throw new Error("The countertop API is not available");
      await api.setDragEnabled(false);
      await api.resetOffset();
      const next = await api.whenSettled();
      if (await commitHostedSinkLanding(api)) {
        if (session) await teardown(session);
        return;
      }
      await onCommitted?.(next);
      if (session) await teardown(session);
    });
  };

  useImperativeHandle(ref, () => ({ enter, standard, apply }));

  /** `getState().resizeBoundsM[side]` first (phase-1 §6a); older builds: frame, then collection limits. */
  const resizeLimits = (side: CountertopResizeSide) => {
    const bounds = resizeBoundsLimitsM(getCountertopRuntimeState(), side);
    if (bounds) return bounds;
    const limits = store.get()?.limits;
    return limits ? { minM: limits.minLengthM, maxM: limits.maxLengthM } : limitsInToMetres(lengthLimitsIn);
  };
  const boundLength = (side: CountertopResizeSide, lengthM: number) => clampLength(lengthM, resizeLimits(side));

  const pumpLength = (session: Session) => {
    const queue = lengthQueueRef.current;
    const request = queue.next;
    if (queue.current || !request) return;
    queue.next = null;
    const current = Promise.resolve()
      .then(request.send)
      .then(
        () => undefined,
        (failure) => {
          if (mountedRef.current) setError(countertopErrorMessage(failure));
        },
      )
      .then(async () => {
        if (request.clearPreview) await quiet(session.bridge.previewCountertopLength?.(null), false);
      })
      .finally(() => {
        if (queue.current === current) queue.current = null;
        if (sessionRef.current === session) pumpLength(session);
        else queue.next = null;
      });
    queue.current = current;
  };

  const queueLength = (session: Session, request: LengthRequest) => {
    const queue = lengthQueueRef.current;
    // Latest wins; a dropped resize still owes the preview clear.
    const clearPreview = request.clearPreview || queue.next?.clearPreview === true;
    queue.next = { ...request, clearPreview };
    pumpLength(session);
  };

  const isMethodUnavailable = (failure: unknown) =>
    typeof failure === "object" && failure !== null && (failure as { code?: unknown }).code === "API_METHOD_UNAVAILABLE";

  /**
   * One-sided resize (the other end stays put), on a standard top too. Builds without `resizeFrom`
   * fall back to a symmetric setSize, but only on a moved top: on a standard one it throws
   * COUNTERTOP_ATTACHED.
   */
  const resizeFrom = (side: CountertopResizeSide, lengthM: number) => {
    const session = sessionRef.current;
    if (!session) return;
    const bounded = boundLength(side, lengthM);
    const send = async () => {
      if (typeof session.api.resizeFrom === "function") return session.api.resizeFrom(side, bounded);
      if (session.bridge.resizeCountertopFrom) {
        try {
          return await session.bridge.resizeCountertopFrom(side, bounded);
        } catch (failure) {
          if (!isMethodUnavailable(failure)) throw failure;
        }
      }
      if (isStandardCountertop(getCountertopRuntimeState()) || store.get()?.attached === true)
        throw new Error("This build cannot resize a standard countertop from one end");
      return session.api.setSize({ length: bounded });
    };
    queueLength(session, { send, clearPreview: true });
  };

  const preview = (next: CountertopLengthPreview | null) => {
    const session = sessionRef.current;
    if (!session) return;
    void quiet(session.bridge.previewCountertopLength?.(next), false);
  };

  /** Snapped length under the pointer (§6a), kept inside `resizeBoundsM[side]` for the ghost. */
  const lengthAtPointer = async (
    side: CountertopResizeSide,
    point: PlacementOverlayPoint,
    options: { snap?: boolean } = { snap: true },
  ): Promise<CountertopLengthAtPointer | null> => {
    const hit = await quiet(sessionRef.current?.bridge.countertopLengthAtPointer?.(side, point, options), null);
    const bounds = hit && resizeBoundsLimitsM(getCountertopRuntimeState(), side);
    if (!hit || !bounds) return hit;
    return {
      ...hit,
      lengthM: clampLength(hit.lengthM, bounds),
      limits: { minLengthM: bounds.minM, maxLengthM: bounds.maxM },
    };
  };

  // First child in both branches, so Continue's switch into drag mode keeps it mounted to fade out.
  const intro = (
    <CountertopLayoutIntroModal isOpening={isIntroOpen} onContinue={handleIntroContinue} onClose={handleIntroClose} />
  );

  if (!active)
    return (
      <>
        {intro}
        {error && (
          <p className={s.message} role="alert" style={{ position: "absolute", top: 24, right: 24, zIndex: 26 }}>
            {error}
          </p>
        )}
      </>
    );
  return (
    <>
      {intro}
      {overlay && (
        <CountertopDragOverlay
          store={store}
          lengthAtPointer={lengthAtPointer}
          pending={pending}
          onApply={apply}
          onCancel={cancel}
          onPreview={preview}
          onResizeFrom={resizeFrom}
        />
      )}
      <div className={s.toolbar} aria-label="Countertop Drag & Drop">
        {!overlay && (
          <div className={s.toolbarButtons}>
            <button type="button" className={s.secondaryPill} disabled={pending} onClick={cancel}>
              Cancel
            </button>
            <button type="button" className={s.primaryPill} disabled={pending} onClick={apply}>
              Apply
            </button>
          </div>
        )}
        {error && (
          <p className={s.message} role="alert">
            {error}
          </p>
        )}
        {!overlay && validation && (!error || validation.tone === "invalid") && (
          <p
            className={clsx(s.message, validation.tone === "warning" && s.warning)}
            role={validation.tone === "invalid" ? "alert" : "status"}
            data-validation={validation.tone}
          >
            {validation.lines.join(" ")}
          </p>
        )}
      </div>
    </>
  );
});
