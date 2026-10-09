import { useRef, useSyncExternalStore } from "react";
import clsx from "clsx";

import type {
  CountertopLengthAtPointer,
  CountertopLengthPreview,
  CountertopOverlayFrame,
  CountertopResizeSide,
} from "@/features/configuratorApi";
import { useCountertopRuntimeState } from "@/shared/hooks/useCountertopRuntimeState";
import { useReasonText } from "@/shared/lib/reasonText";

import { formatInches, metresToDisplayInches } from "../lib/countertopLength";
import type { CountertopOverlayStore } from "../lib/countertopOverlayStore";
import { describeCountertopValidation } from "../lib/countertopSession";
import { CloseIcon, EditIcon, MoveIcon } from "./countertopIcons";
import { CountertopResizeHandles } from "./CountertopResizeHandles";

import s from "./CountertopDragMode.module.scss";

type Props = {
  store: CountertopOverlayStore;
  pending: boolean;
  onApply(): void;
  onCancel(): void;
  lengthAtPointer(
    side: CountertopResizeSide,
    point: { x: number; y: number },
  ): Promise<CountertopLengthAtPointer | null>;
  onPreview(preview: CountertopLengthPreview | null): void;
  onResizeFrom(side: CountertopResizeSide, lengthM: number): void;
};

const visibleFrame = (frame: CountertopOverlayFrame | null) =>
  frame && frame.active !== false && frame.visible && frame.points ? frame : null;

/** Under the bottom-right corner, kept inside the viewport (see cabinet `actionAnchor`). */
const actionAnchor = (frame: CountertopOverlayFrame) => {
  const corner = frame.points?.bottomRight;
  if (!corner) return null;
  const width = frame.viewport?.width || Infinity;
  const height = frame.viewport?.height || Infinity;
  return { x: Math.min(Math.max(corner.x, 64), width - 30), y: Math.min(Math.max(corner.y, 0), height - 30) };
};

/**
 * Countertop Drag & Drop icons at the anchors PlayCanvas publishes: move icon at the centre, the
 * length / depth chips, the resize handles at both ends and Apply + × under the bottom-right corner.
 * The length is read-only on every top: it changes only through the end handles (client §17), which
 * also work on a standard (attached) top and take their limits from `getState().resizeBoundsM`.
 * The tint is drawn by PlayCanvas; the layer takes pointer input only on its controls.
 */
export function CountertopDragOverlay({
  store,
  pending,
  onApply,
  onCancel,
  lengthAtPointer,
  onPreview,
  onResizeFrom,
}: Props) {
  const frame = visibleFrame(useSyncExternalStore(store.subscribe, store.get));
  const runtime = useCountertopRuntimeState();
  const resizeBoundsM = runtime?.resizeBoundsM;
  const rootRef = useRef<HTMLDivElement>(null);
  const validation = describeCountertopValidation(runtime?.validation, useReasonText());

  if (!frame?.points) return null;
  const points = frame.points;
  // Red: the overlay's own conflict, or the runtime's verdict (state.validation) is invalid.
  const invalid = validation?.tone === "invalid";
  const colliding = frame.status === "colliding" || invalid;
  const center = points.center ?? points.frontCenter;
  const lengthAnchor = points.lengthLabel ?? points.topCenter;
  const depthAnchor = points.depthLabel ?? points.rightEnd;
  const action = actionAnchor(frame);
  const frameReason = !frame.canApply || frame.status === "colliding" ? frame.reasons?.[0]?.message : undefined;
  // Invalid verdict first; else the overlay's reason; else the warning (amber, does not block Apply).
  const reason = invalid ? validation.lines.join(" ") : (frameReason ?? validation?.lines.join(" "));
  const warning = !invalid && !frameReason && validation?.tone === "warning";
  const lengthIn = typeof frame.lengthM === "number" ? metresToDisplayInches(frame.lengthM) : null;
  const origin = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
  };

  return (
    <div
      ref={rootRef}
      className={clsx(s.overlay, colliding && s.colliding)}
      data-status={frame.status}
      data-testid="countertop-drag-overlay"
    >
      {frame.preview && frame.hull.length > 2 && (
        // Ghost of the previewed length (handle drag): PlayCanvas publishes the virtual box's hull;
        // the 3D top changes once, on release.
        <svg className={s.ghost} aria-hidden="true" data-testid="countertop-length-ghost">
          <polygon points={frame.hull.map((point) => `${point.x},${point.y}`).join(" ")} />
        </svg>
      )}
      {center && (
        <span className={s.moveMarker} style={{ left: center.x, top: center.y }} aria-hidden="true">
          <MoveIcon />
        </span>
      )}
      {lengthAnchor && lengthIn !== null && (
        <>
          <span className={s.chip} style={{ left: lengthAnchor.x, top: lengthAnchor.y }} data-testid="countertop-length-chip">
            {formatInches(lengthIn)}
          </span>
          <p className={clsx(s.message, s.lengthHint)} style={{ left: lengthAnchor.x, top: lengthAnchor.y + 16 }}>
            Drag the ends to change the length
          </p>
        </>
      )}
      {depthAnchor && typeof frame.depthM === "number" && (
        <span
          className={s.chip}
          style={{ left: depthAnchor.x + 28, top: depthAnchor.y }}
          data-testid="countertop-depth-chip"
        >
          {formatInches(metresToDisplayInches(frame.depthM))} <EditIcon />
        </span>
      )}
      <CountertopResizeHandles
        frame={frame}
        disabled={pending}
        resizeBoundsM={resizeBoundsM}
        origin={origin}
        lengthAtPointer={lengthAtPointer}
        onPreview={onPreview}
        onCommit={onResizeFrom}
      />
      {action && (
        <>
          <button
            type="button"
            className={s.applyChip}
            style={{ left: action.x - 3, top: action.y + 5 }}
            disabled={pending || !frame.canApply || frame.dragging || invalid}
            title={reason}
            onClick={onApply}
          >
            Apply
          </button>
          <button
            type="button"
            className={s.discardChip}
            style={{ left: action.x + 3, top: action.y + 3 }}
            aria-label="Discard countertop changes"
            disabled={pending}
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
          {reason && (
            <p
              className={clsx(s.message, s.reason, warning && s.warning)}
              style={{ left: action.x + 25, top: action.y + 34 }}
              role={warning ? "status" : "alert"}
              data-validation={invalid ? "invalid" : warning ? "warning" : undefined}
            >
              {reason}
            </p>
          )}
        </>
      )}
    </div>
  );
}
