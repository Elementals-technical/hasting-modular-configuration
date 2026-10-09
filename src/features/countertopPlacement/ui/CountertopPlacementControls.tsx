import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { useReasonText } from "@/shared/lib/reasonText";

import { commitHostedSinkLanding } from "../lib/hostedSinkLanding";

import s from "./CountertopPlacementControls.module.scss";

import {
  countertopErrorMessage,
  restoreCountertopSnapshot,
  sameCountertopTarget,
  type CountertopApi,
  type CountertopSnapshot,
  type CountertopState,
} from "../lib/countertopSession";

export type { CountertopApi, CountertopState } from "../lib/countertopSession";
export type CountertopPlacementHandle = { open(): void };
export type CountertopPlacementAvailability = { supported: boolean; available: boolean; editing: boolean };
type Props = {
  ready: boolean;
  disabled: boolean;
  getApi: () => CountertopApi | null;
  onAvailabilityChange?: (availability: CountertopPlacementAvailability) => void;
  onCommitted?: (state: CountertopState) => void | Promise<void>;
  onSelect?: (productId: string) => void;
};
type Snapshot = CountertopSnapshot & { api: CountertopApi };
const requiredMethods = [
  "getState",
  "setDragEnabled",
  "setOffset",
  "resetOffset",
  "setSize",
  "whenSettled",
  "on",
] as const;
const sameTarget = sameCountertopTarget;
const metres = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? String(Number(value.toFixed(4))) : "";
/** Slug texts / busy / not-ready via the shared description; effects use the UI dictionary. */
const messageOf = countertopErrorMessage;

/** Countertop edits are live API writes. The snapshot provides explicit UI Apply/Cancel semantics. */
export const CountertopPlacementControls = forwardRef<CountertopPlacementHandle, Props>(
  function CountertopPlacementControls({ ready, disabled, getApi, onAvailabilityChange, onCommitted, onSelect }, ref) {
    const apiRef = useRef<CountertopApi | null>(null);
    const snapshotRef = useRef<Snapshot | null>(null);
    const pendingRef = useRef(false);
    const mountedRef = useRef(true);
    const openRef = useRef<() => void>(() => undefined);
    const offsetDirtyRef = useRef(false);
    const lengthDirtyRef = useRef(false);
    const [supported, setSupported] = useState(false);
    const [state, setState] = useState<CountertopState | null>(null);
    const [editing, setEditing] = useState(false);
    const [pending, setPending] = useState(false);
    const [mode, setMode] = useState<"standard" | "layout">("layout");
    const [x, setX] = useState("0");
    const [y, setY] = useState("0");
    const [length, setLength] = useState("");
    const [autoLength, setAutoLength] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const reasonText = useReasonText();
    const [status, setStatus] = useState("");
    const targetCurrent =
      !snapshotRef.current ||
      Boolean(ready && state && snapshotRef.current.api === apiRef.current && sameTarget(state, snapshotRef.current));
    const available =
      ready &&
      supported &&
      state?.readiness === "ready" &&
      Boolean(state.productId && state.compositionId) &&
      !disabled &&
      !pending &&
      !editing;
    const dragging = state?.dragging === true || state?.moving === true;
    const blocked = disabled || pending || state?.readiness !== "ready" || !targetCurrent || dragging;
    // Offset-only (4″) top: no lift from this panel either; the label keeps the tooltip on a disabled field.
    const verticalLocked = state?.verticalLocked === true;
    const verticalLockedText = reasonText({ code: "COUNTERTOP_VERTICAL_LOCKED" });

    useEffect(() => {
      mountedRef.current = true;
      let disposed = false;
      const stops: (() => void)[] = [];
      let supportedApi: CountertopApi | null = null;
      let discoveryTimer: ReturnType<typeof setTimeout> | undefined;
      let discoveryAttempts = 0;
      apiRef.current = null;
      setSupported(false);
      setState(null);
      const update = (next: CountertopState) => {
        if (disposed) return;
        setState(next);
        if (
          snapshotRef.current &&
          (snapshotRef.current.api !== apiRef.current || !sameTarget(next, snapshotRef.current))
        ) {
          setError(
            "The countertop or composition changed. These edits cannot be applied or restored to the new target.",
          );
        }
        if (!offsetDirtyRef.current) {
          setX(metres(next.offset?.x ?? 0));
          setY(metres(next.offset?.y ?? 0));
        }
        // Pointer drag events must not overwrite a length the user is entering.
        if (!lengthDirtyRef.current) {
          setLength(metres(next.customLength ?? next.size?.length ?? next.autoLength));
          setAutoLength(next.customLength == null);
        }
      };
      const discover = () => {
        if (disposed || !ready || supportedApi) return;
        discoveryAttempts += 1;
        const candidate = getApi();
        if (!candidate || !requiredMethods.every((method) => typeof candidate[method] === "function")) {
          if (discoveryAttempts < 51) discoveryTimer = setTimeout(discover, 300);
          return;
        }
        supportedApi = candidate;
        apiRef.current = candidate;
        setSupported(true);
        void Promise.resolve()
          .then(() => candidate.getState())
          .then(update)
          .catch((failure) => {
            if (!disposed) setError(messageOf(failure));
          });
        try {
          stops.push(candidate.on("change", (event) => update(event.state), { emitCurrent: true }));
          stops.push(
            candidate.on("action", (event) => {
              if (!disposed && event.type === "edit-size") openRef.current();
            }),
          );
        } catch (failure) {
          setError(messageOf(failure));
        }
      };
      discover();
      return () => {
        disposed = true;
        if (discoveryTimer) clearTimeout(discoveryTimer);
        mountedRef.current = false;
        stops.forEach((stop) => stop());
        const original = snapshotRef.current;
        if (supportedApi && original && original.api === supportedApi) {
          const boundApi = supportedApi;
          void Promise.resolve()
            .then(() => boundApi.getState())
            .then((current) => {
              if (current.readiness === "ready" && sameTarget(current, original)) return boundApi.setDragEnabled(false);
            })
            .catch(() => undefined);
        }
        if (apiRef.current === supportedApi) apiRef.current = null;
      };
    }, [ready, getApi]);

    useEffect(() => {
      onAvailabilityChange?.({ supported: ready && supported, available, editing });
      return () => onAvailabilityChange?.({ supported: false, available: false, editing: false });
    }, [ready, supported, available, editing, onAvailabilityChange]);

    const readTarget = async (api: CountertopApi) => {
      if (apiRef.current !== api) throw new Error("The countertop API changed");
      const next = await api.getState();
      if (apiRef.current !== api) throw new Error("The countertop API changed");
      const original = snapshotRef.current;
      if (!original || original.api !== api || !sameTarget(next, original))
        throw new Error("The countertop or composition changed; no command was sent to the new target");
      if (next.readiness !== "ready") throw new Error("The countertop is not ready");
      if (next.dragging || next.moving) throw new Error("Finish dragging the countertop before changing its placement");
      if (mountedRef.current) setState(next);
      return next;
    };
    const run = async (action: (api: CountertopApi) => Promise<void>) => {
      const api = apiRef.current;
      if (!api || pendingRef.current || disabled) return;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        await action(api);
      } catch (failure) {
        if (mountedRef.current) {
          if (!snapshotRef.current) setEditing(false);
          // setOffset uses the default `guard`: POSE_INVALID arrives already reverted, with slugs.
          setError(messageOf(failure, reasonText));
        }
      } finally {
        pendingRef.current = false;
        if (mountedRef.current) setPending(false);
      }
    };
    const begin = () => {
      if (!available || pendingRef.current || snapshotRef.current) return;
      setEditing(true);
      onAvailabilityChange?.({ supported: true, available: false, editing: true });
      void run(async (api) => {
        const current = await api.getState();
        if (apiRef.current !== api || current.readiness !== "ready" || !current.productId || !current.compositionId) {
          setEditing(false);
          throw new Error("The countertop is not ready");
        }
        snapshotRef.current = {
          api,
          productId: current.productId,
          compositionId: current.compositionId,
          offset: { x: current.offset?.x ?? 0, y: current.offset?.y ?? 0 },
          attached: current.attached === true,
          customLength: current.customLength ?? null,
          dragEnabled: current.dragEnabled === true,
        };
        setState(current);
        setMode("layout");
        offsetDirtyRef.current = false;
        lengthDirtyRef.current = false;
        setX(metres(current.offset?.x ?? 0));
        setY(metres(current.offset?.y ?? 0));
        setLength(metres(current.customLength ?? current.size?.length ?? current.autoLength));
        setAutoLength(current.customLength == null);
        await readTarget(api);
        await api.setDragEnabled(true);
        await readTarget(api);
        onSelect?.(current.productId);
        setStatus("Preview edits are live. Apply keeps them; Cancel restores the original position and length.");
      });
    };
    openRef.current = begin;
    useImperativeHandle(ref, () => ({ open: begin }));
    const settled = async (api: CountertopApi) => {
      await api.whenSettled();
      return readTarget(api);
    };
    const finish = () => {
      snapshotRef.current = null;
      setEditing(false);
      offsetDirtyRef.current = false;
      lengthDirtyRef.current = false;
    };
    const chooseMode = (nextMode: "standard" | "layout") =>
      void run(async (api) => {
        await readTarget(api);
        setMode(nextMode);
        if (nextMode === "standard") {
          await api.setDragEnabled(false);
          await readTarget(api);
          await api.resetOffset();
          await readTarget(api);
          await api.setSize({ length: null });
          const next = await settled(api);
          await commitHostedSinkLanding(api);
          if (!next.attached) throw new Error("The countertop did not return to its standard position");
          offsetDirtyRef.current = false;
          setX(metres(next.offset?.x ?? 0));
          setY(metres(next.offset?.y ?? 0));
          setAutoLength(true);
          lengthDirtyRef.current = false;
          setLength(metres(next.size?.length ?? next.autoLength));
        } else {
          await api.setDragEnabled(true);
          const next = await readTarget(api);
          if (next.productId) onSelect?.(next.productId);
        }
      });
    const cancel = () =>
      void run(async (api) => {
        await readTarget(api);
        await restoreCountertopSnapshot(api, snapshotRef.current!, {
          read: () => readTarget(api),
          settled: () => settled(api),
        });
        await commitHostedSinkLanding(api);
        finish();
        setStatus("Edits cancelled");
      });
    const apply = () =>
      void run(async (api) => {
        await readTarget(api);
        await api.setDragEnabled(false);
        if (offsetDirtyRef.current) {
          if (!validOffset) throw new Error("Offsets must be finite numbers in metres");
          await readTarget(api);
          await api.setOffset({ x: Number(x), y: Number(y) });
          const positioned = await settled(api);
          await commitHostedSinkLanding(api);
          offsetDirtyRef.current = false;
          setX(metres(positioned.offset?.x ?? 0));
          setY(metres(positioned.offset?.y ?? 0));
        }
        if (lengthDirtyRef.current) {
          if (!validLength) throw new Error("Length must be a positive finite number of metres");
          const current = await readTarget(api);
          if (!autoLength && !current.canResize)
            throw new Error("Move the countertop away from the cabinets to set a custom length");
          await api.setSize({ length: autoLength ? null : Number(length) });
          await settled(api);
          lengthDirtyRef.current = false;
        }
        const next = await settled(api);
        await onCommitted?.(next);
        finish();
        setStatus("Countertop changes applied");
      });
    const validOffset = x.trim() !== "" && y.trim() !== "" && Number.isFinite(Number(x)) && Number.isFinite(Number(y));
    const validLength = autoLength || (length.trim() !== "" && Number.isFinite(Number(length)) && Number(length) > 0);

    if (!supported && !editing) return null;
    return (
      <section className={s.panel} aria-label="Countertop positioning">
        {!editing ? (
          <button type="button" disabled={!available} onClick={begin}>
            Countertop: Position &amp; Size
          </button>
        ) : (
          <>
            <h3>Countertop Position &amp; Size</h3>
            <p>Dimensions and offsets are in metres. Preview changes affect the canvas immediately.</p>
            <label>
              Positioning
              <select
                aria-label="Countertop positioning mode"
                value={mode}
                disabled={blocked}
                onChange={(event) => chooseMode(event.target.value as "standard" | "layout")}
              >
                <option value="standard">Standard</option>
                <option value="layout">Layout</option>
              </select>
            </label>
            <div className={s.fields}>
              <label>
                Offset X (m)
                <input
                  type="number"
                  step="0.01"
                  value={x}
                  disabled={blocked || mode !== "layout"}
                  onChange={(event) => {
                    offsetDirtyRef.current = true;
                    setX(event.target.value);
                  }}
                />
              </label>
              <label title={verticalLocked ? verticalLockedText : undefined}>
                Offset Y (m)
                <input
                  type="number"
                  step="0.01"
                  value={y}
                  disabled={blocked || mode !== "layout" || verticalLocked}
                  onChange={(event) => {
                    offsetDirtyRef.current = true;
                    setY(event.target.value);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={blocked || mode !== "layout" || !validOffset}
              onClick={() =>
                void run(async (api) => {
                  await readTarget(api);
                  await api.setOffset({ x: Number(x), y: Number(y) });
                  const next = await settled(api);
                  await commitHostedSinkLanding(api);
                  offsetDirtyRef.current = false;
                  setX(metres(next.offset?.x ?? 0));
                  setY(metres(next.offset?.y ?? 0));
                })
              }
            >
              Preview position
            </button>
            <label>
              Length (m)
              <input
                type="number"
                min="0"
                step="0.01"
                value={length}
                disabled={blocked || mode !== "layout"}
                onChange={(event) => {
                  lengthDirtyRef.current = true;
                  setLength(event.target.value);
                  setAutoLength(false);
                }}
              />
            </label>
            <div className={s.buttons}>
              <button
                type="button"
                disabled={blocked || mode !== "layout"}
                aria-pressed={autoLength}
                onClick={() => {
                  lengthDirtyRef.current = true;
                  setAutoLength(true);
                }}
              >
                Auto length
              </button>
              <button
                type="button"
                disabled={blocked || !validLength || (!autoLength && !state?.canResize)}
                onClick={() =>
                  void run(async (api) => {
                    await readTarget(api);
                    await api.setSize({ length: autoLength ? null : Number(length) });
                    const next = await settled(api);
                    lengthDirtyRef.current = false;
                    setLength(metres(next.customLength ?? next.size?.length ?? next.autoLength));
                    setAutoLength(next.customLength == null);
                  })
                }
              >
                Preview size
              </button>
            </div>
            {!state?.canResize && mode === "layout" && (
              <p>Move the countertop away from the cabinets to set a custom length.</p>
            )}
            <div className={s.fields}>
              <label>
                Depth (m)
                <input value={metres(state?.size?.depth)} readOnly />
              </label>
              <label>
                Thickness (m)
                <input value={metres(state?.thickness)} readOnly />
              </label>
            </div>
            <p>Depth and thickness are read-only in this API.</p>
            <div className={s.buttons}>
              <button
                type="button"
                disabled={
                  blocked || (offsetDirtyRef.current && !validOffset) || (lengthDirtyRef.current && !validLength)
                }
                onClick={apply}
              >
                Apply countertop
              </button>
              <button type="button" disabled={blocked} onClick={cancel}>
                Cancel countertop
              </button>
            </div>
            {dragging && <p>Finish dragging before Apply or Cancel.</p>}
            {!targetCurrent && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  finish();
                  setStatus("Stale editor closed; no commands were sent to the new countertop.");
                }}
              >
                Close stale editor
              </button>
            )}
          </>
        )}
        {status && <p role="status">{status}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    );
  },
);
