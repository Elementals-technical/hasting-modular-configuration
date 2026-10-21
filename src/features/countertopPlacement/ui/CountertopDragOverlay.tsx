import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";

import type {
  CountertopLengthAtPointer,
  CountertopLengthLimitsM,
  CountertopLengthPreview,
  CountertopOverlayFrame,
  CountertopResizeSide,
} from "@/features/configuratorApi";
import { useCountertopRuntimeState } from "@/shared/hooks/useCountertopRuntimeState";
import { useReasonText } from "@/shared/lib/reasonText";

import { formatInches, metresToDisplayInches } from "../lib/countertopLength";
import type { CountertopOverlayStore } from "../lib/countertopOverlayStore";
import { describeCountertopValidation } from "../lib/countertopSession";
import { clearEditSizeButton } from "../lib/editSizeButtonClearance";
import {
  actionRowBox,
  actionRowPositions,
  countertopScreenBox,
  placeLengthHint,
  REASON_FALLBACK_SIZE_PX,
} from "../lib/lengthHintPlacement";
import { readEditSizeButtonRect } from "../lib/readEditSizeButtonRect";
import { CloseIcon, EditIcon, MoveIcon } from "./countertopIcons";
import { CountertopDimensionPopover } from "./CountertopDimensionPopover/CountertopDimensionPopover";
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
  /** The collection's length limits, for a build that publishes none. */
  lengthLimitsM: CountertopLengthLimitsM;
};

/** The chip whose popover is open. */
type DimensionEditor = "length" | "depth";

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
 * The length changes through the end handles (client §17), which also work on a standard (attached)
 * top and take their limits from `getState().resizeBoundsM`. The ✎ of a chip opens its popover
 * (`CountertopDimensionPopover`): Length with Align, or Depth alone; one at a time.
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
  lengthLimitsM,
}: Props) {
  const frame = visibleFrame(useSyncExternalStore(store.subscribe, store.get));
  const runtime = useCountertopRuntimeState();
  const resizeBoundsM = runtime?.resizeBoundsM;
  const rootRef = useRef<HTMLDivElement>(null);
  const validation = describeCountertopValidation(runtime?.validation, useReasonText());
  const [openEditor, setOpenEditor] = useState<DimensionEditor | null>(null);
  // No scene command takes a typed length with an alignment, or a depth, yet: a popover's Apply only
  // closes it, nothing is sent and the session goes on as it was.
  const closeEditor = useCallback(() => setOpenEditor(null), []);
  const toggleEditor = (editor: DimensionEditor) => setOpenEditor((open) => (open === editor ? null : editor));
  // The reason text wraps by its length and position; the length hint keeps clear of its rendered box.
  const [reasonElement, setReasonElement] = useState<HTMLParagraphElement | null>(null);
  const [reasonSize, setReasonSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!reasonElement || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setReasonSize({ width: reasonElement.offsetWidth, height: reasonElement.offsetHeight }),
    );
    observer.observe(reasonElement);
    return () => observer.disconnect();
  }, [reasonElement]);

  if (!frame?.points) return null;
  const points = frame.points;
  // Red: the overlay's own conflict, or the runtime's verdict (state.validation) is invalid.
  const invalid = validation?.tone === "invalid";
  const colliding = frame.status === "colliding" || invalid;
  // The scene draws its Edit size button over the top under the same flag (`canResize`: a lifted top);
  // the move marker and the length chip step off it, and the length popover follows the chip.
  const { marker: center, chip: lengthAnchor } = clearEditSizeButton(
    runtime?.canResize === true ? readEditSizeButtonRect() : null,
    { marker: points.center ?? points.frontCenter ?? null, chip: points.lengthLabel ?? points.topCenter ?? null },
  );
  const depthAnchor = points.depthLabel ?? points.rightEnd;
  // The depth chip stands beside its anchor.
  const depthChip = depthAnchor ? { x: depthAnchor.x + 28, y: depthAnchor.y } : null;
  const depthIn = typeof frame.depthM === "number" ? metresToDisplayInches(frame.depthM) : null;
  const action = actionAnchor(frame);
  const actionRow = action ? actionRowPositions(action) : null;
  const frameReason = !frame.canApply || frame.status === "colliding" ? frame.reasons?.[0]?.message : undefined;
  // Invalid verdict first; else the overlay's reason; else the warning (amber, does not block Apply).
  const reason = invalid ? validation.lines.join(" ") : (frameReason ?? validation?.lines.join(" "));
  const warning = !invalid && !frameReason && validation?.tone === "warning";
  const topBox = countertopScreenBox(frame);
  // Under the top's lower edge, off the move marker and the scene's Edit size button at its centre.
  const lengthHint =
    topBox &&
    placeLengthHint({
      top: topBox,
      marker: center,
      actionRow: action ? actionRowBox(action, reason ? (reasonSize ?? REASON_FALLBACK_SIZE_PX) : null) : null,
      viewport: frame.viewport,
    });
  const lengthIn = typeof frame.lengthM === "number" ? metresToDisplayInches(frame.lengthM) : null;
  // The runtime's effective limits first (raised to fit the basin cut-outs), then the frame's.
  const effectiveLimits = runtime?.lengthLimitsM ?? frame.limits;
  const lengthEditLimitsM = effectiveLimits
    ? { minM: effectiveLimits.minLengthM, maxM: effectiveLimits.maxLengthM }
    : lengthLimitsM;
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
          <button
            type="button"
            className={s.chip}
            style={{ left: lengthAnchor.x, top: lengthAnchor.y }}
            aria-label={`Edit countertop length, ${formatInches(lengthIn)}`}
            aria-haspopup="dialog"
            aria-expanded={openEditor === "length"}
            disabled={pending || frame.dragging}
            onClick={() => toggleEditor("length")}
            data-testid="countertop-length-chip"
          >
            {formatInches(lengthIn)} <EditIcon />
          </button>
          {lengthHint && (
            <p className={clsx(s.message, s.lengthHint)} style={{ left: lengthHint.x, top: lengthHint.y }}>
              Drag the ends to change the length
            </p>
          )}
          {openEditor === "length" && frame.lengthM !== null && (
            <CountertopDimensionPopover
              label="Length"
              anchor={lengthAnchor}
              overlayRef={rootRef}
              valueM={frame.lengthM}
              limitsM={lengthEditLimitsM}
              alignable
              onApply={closeEditor}
              onClose={closeEditor}
            />
          )}
        </>
      )}
      {depthChip && depthIn !== null && (
        <>
          <button
            type="button"
            className={s.chip}
            style={{ left: depthChip.x, top: depthChip.y }}
            aria-label={`Edit countertop depth, ${formatInches(depthIn)}`}
            aria-haspopup="dialog"
            aria-expanded={openEditor === "depth"}
            disabled={pending || frame.dragging}
            onClick={() => toggleEditor("depth")}
            data-testid="countertop-depth-chip"
          >
            {formatInches(depthIn)} <EditIcon />
          </button>
          {openEditor === "depth" && frame.depthM !== null && (
            <CountertopDimensionPopover
              label="Depth"
              anchor={depthChip}
              overlayRef={rootRef}
              valueM={frame.depthM}
              onApply={closeEditor}
              onClose={closeEditor}
            />
          )}
        </>
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
      {actionRow && (
        <>
          <button
            type="button"
            className={s.applyChip}
            style={{ left: actionRow.apply.x, top: actionRow.apply.y }}
            disabled={pending || !frame.canApply || frame.dragging || invalid}
            title={reason}
            onClick={onApply}
          >
            Apply
          </button>
          <button
            type="button"
            className={s.discardChip}
            style={{ left: actionRow.discard.x, top: actionRow.discard.y }}
            aria-label="Discard countertop changes"
            disabled={pending}
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
          {reason && (
            <p
              ref={setReasonElement}
              className={clsx(s.message, s.reason, warning && s.warning)}
              style={{ left: actionRow.reason.x, top: actionRow.reason.y }}
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
