import { useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";

import type {
  CountertopLengthAtPointer,
  CountertopLengthPreview,
  CountertopOverlayFrame,
  CountertopResizeSide,
} from "@/features/configuratorApi";

import {
  clampLength,
  effectiveLimitsM,
  formatInches,
  metresToDisplayInches,
  METRES_PER_INCH,
  presetsWithinLimits,
  resolveCountertopLengthPresetsIn,
  type LengthLimitsIn,
} from "../lib/countertopLength";
import type { CountertopOverlayStore } from "../lib/countertopOverlayStore";
import { CloseIcon, EditIcon, MoveIcon } from "./countertopIcons";
import { CountertopResizeHandles } from "./CountertopResizeHandles";

import s from "./CountertopDragMode.module.scss";

type Props = {
  store: CountertopOverlayStore;
  lengthLimitsIn: LengthLimitsIn;
  /** The collection's raw `countertop.lengthPresetsIn`; defaults to 23.6-120 in presets (23.6 = one 60 cm cabinet). */
  lengthPresetsIn?: number[];
  pending: boolean;
  onApply(): void;
  onCancel(): void;
  onLength(lengthM: number): void;
  lengthAtPointer(
    side: CountertopResizeSide,
    point: { x: number; y: number },
  ): Promise<CountertopLengthAtPointer | null>;
  onPreview(preview: CountertopLengthPreview | null): void;
  onResizeFrom(side: CountertopResizeSide, lengthM: number): void;
};

const EPSILON_M = 1e-6;

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
 * The length chip is the primary control of a remote top: −/+ (1 in), presets, ✎ numeric entry and,
 * below the minimum, a "Set <min>" pill (no auto-extend). An attached top shows its length read-only.
 * The tint is drawn by PlayCanvas; the layer takes pointer input only on its controls.
 */
export function CountertopDragOverlay({
  store,
  lengthLimitsIn,
  lengthPresetsIn,
  pending,
  onApply,
  onCancel,
  onLength,
  lengthAtPointer,
  onPreview,
  onResizeFrom,
}: Props) {
  const frame = visibleFrame(useSyncExternalStore(store.subscribe, store.get));
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (!frame?.points) return null;
  const points = frame.points;
  const colliding = frame.status === "colliding";
  const limits = effectiveLimitsM(frame, lengthLimitsIn);
  const minIn = metresToDisplayInches(limits.minM);
  const maxIn = metresToDisplayInches(limits.maxM);
  const center = points.center ?? points.frontCenter;
  const lengthAnchor = points.lengthLabel ?? points.topCenter;
  const depthAnchor = points.depthLabel ?? points.rightEnd;
  const action = actionAnchor(frame);
  const reason = !frame.canApply || colliding ? frame.reasons?.[0]?.message : undefined;
  const attached = frame.attached === true;
  const lengthM = typeof frame.lengthM === "number" ? frame.lengthM : null;
  const lengthIn = lengthM === null ? null : metresToDisplayInches(lengthM);
  const presets = presetsWithinLimits(resolveCountertopLengthPresetsIn(lengthPresetsIn), limits);
  const belowMin = !attached && lengthM !== null && lengthM < limits.minM - EPSILON_M;
  const atMin = lengthM !== null && lengthM <= limits.minM + EPSILON_M;
  const atMax = lengthM !== null && lengthM >= limits.maxM - EPSILON_M;
  const origin = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
  };
  const step = (deltaIn: number) => {
    if (lengthM === null) return;
    onLength(clampLength(lengthM + deltaIn * METRES_PER_INCH, limits));
  };
  const pickPreset = (presetIn: number) => {
    setPresetsOpen(false);
    // Presets are 0.1-in display values: 23.6 applies the exact one-cabinet minimum (0.6 m).
    onLength(clampLength(presetIn * METRES_PER_INCH, limits));
  };

  const applyLength = () => {
    const inches = Number(lengthDraft);
    if (lengthDraft === null || lengthDraft.trim() === "" || !Number.isFinite(inches)) return;
    onLength(clampLength(inches * METRES_PER_INCH, limits));
    setLengthDraft(null);
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
      {lengthAnchor && lengthIn !== null && attached && (
        <>
          <span className={s.chip} style={{ left: lengthAnchor.x, top: lengthAnchor.y }} data-testid="countertop-length-chip">
            {formatInches(lengthIn)}
          </span>
          <p className={clsx(s.message, s.lengthHint)} style={{ left: lengthAnchor.x, top: lengthAnchor.y + 16 }}>
            Move the countertop off the cabinets to change its length
          </p>
        </>
      )}
      {lengthAnchor && lengthIn !== null && !attached && (
        <div
          className={clsx(s.chip, s.lengthControl)}
          style={{ left: lengthAnchor.x, top: lengthAnchor.y }}
          role="group"
          aria-label="Countertop length"
          data-testid="countertop-length-chip"
        >
          <button
            type="button"
            className={s.stepButton}
            aria-label="Shorten countertop by 1 inch"
            disabled={pending || atMin}
            onClick={() => step(-1)}
          >
            −
          </button>
          <button
            type="button"
            className={s.lengthValue}
            aria-label="Edit countertop length"
            disabled={pending}
            onClick={() => {
              setPresetsOpen(false);
              setLengthDraft(String(lengthIn));
            }}
          >
            {formatInches(lengthIn)} <EditIcon />
          </button>
          {presets.length > 0 && (
            <button
              type="button"
              className={s.stepButton}
              aria-label="Length presets"
              aria-haspopup="menu"
              aria-expanded={presetsOpen}
              disabled={pending}
              onClick={() => {
                setLengthDraft(null);
                setPresetsOpen((open) => !open);
              }}
            >
              ▾
            </button>
          )}
          <button
            type="button"
            className={s.stepButton}
            aria-label="Lengthen countertop by 1 inch"
            disabled={pending || atMax}
            onClick={() => step(1)}
          >
            +
          </button>
        </div>
      )}
      {presetsOpen && !attached && !pending && lengthAnchor && presets.length > 0 && (
        <div
          className={s.presetsMenu}
          style={{ left: lengthAnchor.x, top: lengthAnchor.y + 16 }}
          role="menu"
          aria-label="Length presets"
        >
          {presets.map((presetIn) => (
            <button
              key={presetIn}
              type="button"
              role="menuitem"
              className={clsx(s.presetItem, presetIn === lengthIn && s.presetCurrent)}
              onClick={() => pickPreset(presetIn)}
            >
              {formatInches(presetIn)}
            </button>
          ))}
        </div>
      )}
      {belowMin && lengthAnchor && !presetsOpen && (
        <button
          type="button"
          className={clsx(s.primaryPill, s.setMinPill)}
          style={{ left: lengthAnchor.x, top: lengthAnchor.y + 18 }}
          disabled={pending}
          onClick={() => onLength(limits.minM)}
        >
          Set {formatInches(metresToDisplayInches(limits.minM))}
        </button>
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
      {!attached && (
        <CountertopResizeHandles
          frame={frame}
          disabled={pending}
          origin={origin}
          lengthAtPointer={lengthAtPointer}
          onPreview={onPreview}
          onCommit={onResizeFrom}
        />
      )}
      {lengthDraft !== null && !attached && lengthAnchor && (
        <div
          className={s.popover}
          style={{ left: lengthAnchor.x, top: lengthAnchor.y }}
          role="dialog"
          aria-label="Length"
        >
          <label>
            Length
            <input
              type="number"
              aria-label="Countertop length (in)"
              step={0.1}
              min={minIn}
              max={maxIn}
              value={lengthDraft}
              onChange={(event) => setLengthDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyLength();
                if (event.key === "Escape") setLengthDraft(null);
              }}
            />
          </label>
          <small>
            Min {formatInches(minIn)} Max {formatInches(maxIn)}
          </small>
          <button type="button" className={s.primaryPill} disabled={pending} onClick={applyLength}>
            Apply
          </button>
        </div>
      )}
      {action && (
        <>
          <button
            type="button"
            className={s.applyChip}
            style={{ left: action.x - 3, top: action.y + 5 }}
            disabled={pending || !frame.canApply || frame.dragging}
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
            <p className={clsx(s.message, s.reason)} style={{ left: action.x + 25, top: action.y + 34 }} role="alert">
              {reason}
            </p>
          )}
        </>
      )}
    </div>
  );
}
