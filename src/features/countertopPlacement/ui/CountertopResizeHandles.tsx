import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import clsx from "clsx";

import type { CountertopOverlayFrame, CountertopState } from "@/features/configuratorApi";

import { formatInches, metresToDisplayInches, resizeBoundsLimitsM } from "../lib/countertopLength";
import {
  bindHandleDragEvents,
  createHandleDragSession,
  nudgeLengthM,
  type CountertopLengthAtPointer,
  type CountertopLengthPreview,
  type CountertopResizeSide,
  type HandleDragSession,
} from "../lib/handleDrag";

import s from "./CountertopResizeHandles.module.scss";

// Declared locally (identical shapes to configuratorApi/types.ts) so this file has no timing dependency.
export type { CountertopLengthAtPointer, CountertopLengthPreview, CountertopResizeSide };

export type CountertopResizeHandlesProps = {
  frame: CountertopOverlayFrame;
  disabled: boolean;
  /** `getState().resizeBoundsM`: per-side limits of a one-end resize (preferred over `frame.limits`). */
  resizeBoundsM?: CountertopState["resizeBoundsM"];
  /** Client px of the overlay root; frame coords = client - origin. */
  origin(): { left: number; top: number };
  lengthAtPointer(
    side: CountertopResizeSide,
    point: { x: number; y: number },
  ): Promise<CountertopLengthAtPointer | null> | CountertopLengthAtPointer | null;
  onPreview(preview: CountertopLengthPreview | null): void;
  onCommit(side: CountertopResizeSide, lengthM: number): void;
};

type ActiveDrag = { side: CountertopResizeSide; lengthM: number; snapKind: string | null };

const SNAP_LABELS: Record<string, string> = {
  edge: "edge",
  cabinetEdge: "edge",
  cabinet: "edge",
  neighbor: "edge",
  neighbour: "edge",
  wall: "wall",
  min: "min",
  minLength: "min",
  max: "max",
  maxLength: "max",
};

export const snapLabelOf = (kind: string | null) => (kind ? (SNAP_LABELS[kind] ?? kind) : null);

const SIDES = ["left", "right"] as const;

/**
 * Resize handles at both countertop ends, on a standard (attached) top too: `resizeFrom` keeps the
 * opposite end fixed (phase-1 §6a). Dragging asks `lengthAtPointer` for the snapped length under the
 * pointer (rAF-throttled, one request in flight), previews it and commits on release; Arrow keys nudge
 * a focused handle by one resize step (0.1″, Shift = 1″) within `resizeBoundsM[side]`.
 */
export function CountertopResizeHandles(props: CountertopResizeHandlesProps) {
  const { frame, disabled } = props;
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const sessionRef = useRef<{ session: HandleDragSession; detach(): void } | null>(null);
  const [active, setActive] = useState<ActiveDrag | null>(null);

  useEffect(
    () => () => {
      const current = sessionRef.current;
      sessionRef.current = null;
      current?.detach();
      current?.session.cancel();
    },
    [],
  );

  const points = frame.points;
  if (!points) return null;
  const colliding = frame.status === "colliding";

  const startDrag = (side: CountertopResizeSide) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || (typeof event.button === "number" && event.button !== 0)) return;
    const startLengthM = frame.lengthM;
    if (typeof startLengthM !== "number" || !Number.isFinite(startLengthM)) return;
    event.preventDefault();
    const previous = sessionRef.current;
    sessionRef.current = null;
    previous?.detach();
    previous?.session.cancel();

    const element = event.currentTarget;
    const pointerId = event.pointerId;
    try {
      if (pointerId !== undefined) element.setPointerCapture?.(pointerId);
    } catch {
      // capture is best-effort (e.g. synthetic events)
    }

    let entry: { session: HandleDragSession; detach(): void } | null = null;
    const session = createHandleDragSession({
      side,
      startLengthM,
      origin: () => propsRef.current.origin(),
      lengthAtPointer: (s2, point) => propsRef.current.lengthAtPointer(s2, point),
      onPreview: (preview) => propsRef.current.onPreview(preview),
      onCommit: (s2, lengthM) => propsRef.current.onCommit(s2, lengthM),
      onResult: (result) => {
        if (sessionRef.current !== entry) return;
        setActive({ side, lengthM: result.lengthM, snapKind: result.snappedTo?.kind ?? null });
      },
      onFinish: () => {
        entry?.detach();
        try {
          if (pointerId !== undefined && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
        if (sessionRef.current === entry) {
          sessionRef.current = null;
          setActive(null);
        }
      },
    });
    entry = { session, detach: bindHandleDragEvents(session, { pointerId }) };
    sessionRef.current = entry;
    setActive({ side, lengthM: startLengthM, snapKind: null });
  };

  const nudge = (side: CountertopResizeSide) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled || sessionRef.current || typeof frame.lengthM !== "number") return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const bounds = resizeBoundsLimitsM({ resizeBoundsM: propsRef.current.resizeBoundsM }, side);
    const limits = bounds ? { minLengthM: bounds.minM, maxLengthM: bounds.maxM } : frame.limits;
    const next = nudgeLengthM({ side, key: event.key, shiftKey: event.shiftKey, lengthM: frame.lengthM, limits });
    if (next !== null) propsRef.current.onCommit(side, next);
  };

  const activePoint = active ? (active.side === "left" ? points.leftEnd : points.rightEnd) : undefined;
  const snapLabel = snapLabelOf(active?.snapKind ?? null);

  return (
    <>
      {SIDES.map((side) => {
        const point = side === "left" ? points.leftEnd : points.rightEnd;
        if (!point) return null;
        const dragging = active?.side === side;
        return (
          <button
            key={side}
            type="button"
            className={clsx(s.handle, colliding && s.colliding, dragging && s.active)}
            style={{ left: point.x, top: point.y }}
            aria-label={`Resize countertop from the ${side} end`}
            data-side={side}
            data-dragging={dragging ? "true" : undefined}
            aria-disabled={disabled || undefined}
            onPointerDown={startDrag(side)}
            onKeyDown={nudge(side)}
          />
        );
      })}
      {active && activePoint && (
        <span
          className={s.tooltip}
          style={{ left: activePoint.x, top: activePoint.y }}
          role="status"
          data-testid="countertop-resize-tooltip"
        >
          {formatInches(metresToDisplayInches(active.lengthM))}
          {snapLabel && <span className={s.snap}>{snapLabel}</span>}
        </span>
      )}
    </>
  );
}
