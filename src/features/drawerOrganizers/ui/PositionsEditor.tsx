import { useId, type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";

import { schematicLines } from "../model/cellsCodec";

import { OUTLINE_INSET, VIEW_BOX_HEIGHT, VIEW_BOX_WIDTH } from "./ColumnSchematic";

import s from "./DividerOptionsPanel.module.scss";

/** The one sentence under the tray (in the strip it is only the counter's title and the group's description). */
const trayHint = (maxActive: number) => `Each insert splits the tray with two walls. Up to ${maxActive} per column.`;

export type PositionsEditorProps = {
  /** How many cells the tray has (5 for ROW-MTL-43). */
  positionCount: number;
  /** The draft: pressed cells, 1 = the back cell. */
  value: readonly number[];
  /** At most this many cells can be pressed at once. */
  maxActive: number;
  layout: "vertical" | "horizontal";
  /** Grows when a click outside the editor should draw attention to Save. */
  pulse: number;
  saving: boolean;
  onToggle(position: number): void;
  onBack(): void;
  onSave(): void;
};

/**
 * The cell's share of the tray length, as the CSS box of its button: cell `index` (0 = the back cell) of
 * `count` equal cells. The tray is laid out top to bottom (back on top) or left to right (back on the left).
 *
 * Example: `cellBox(1, 5, false)` is `{ top: "20%", height: "20%" }`.
 */
const cellBox = (index: number, count: number, horizontal: boolean): CSSProperties => {
  const sizePercent = 100 / count;
  const startPercent = index * sizePercent;
  return horizontal
    ? { left: `${startPercent}%`, width: `${sizePercent}%` }
    : { top: `${startPercent}%`, height: `${sizePercent}%` };
};

type TrayDrawingProps = {
  positionCount: number;
  value: readonly number[];
  horizontal: boolean;
};

/**
 * The tray in the viewBox of `ColumnSchematic` (10 units per cm, the back edge at y = 0). Dashed lines are the
 * borders between cells; solid lines are the walls the pressed cells turn on, from the codec the cards and 3D
 * use. It is drawn upright and turned a quarter for the horizontal strip, so that Back is on the left.
 */
const TrayDrawing = ({ positionCount, value, horizontal }: TrayDrawingProps) => {
  // 1. Walls to draw, and the borders between cells, as fractions of the tray length from the back edge.
  const wallFractions = schematicLines(value);
  const borderFractions = Array.from({ length: positionCount - 1 }, (_, index) => (index + 1) / positionCount);

  // 2. Upright: viewBox 100 x 430. Horizontal: viewBox 430 x 100, the same picture turned -90 degrees
  //    ((x, y) goes to (y, 100 - x)), so the back edge lands on the left.
  const viewBox = horizontal ? `0 0 ${VIEW_BOX_HEIGHT} ${VIEW_BOX_WIDTH}` : `0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`;
  const turn = horizontal ? `translate(0 ${VIEW_BOX_WIDTH}) rotate(-90)` : undefined;

  // 3. preserveAspectRatio "none": in the strip the 430 x 100 tray is fitted to five cells of at least 44 px,
  //    a little off its proportions.
  return (
    <svg className={s.trayDrawing} viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g transform={turn}>
        <rect
          className={s.schematicTray}
          x={OUTLINE_INSET}
          y={OUTLINE_INSET}
          width={VIEW_BOX_WIDTH - 2 * OUTLINE_INSET}
          height={VIEW_BOX_HEIGHT - 2 * OUTLINE_INSET}
          rx={6}
        />
        {borderFractions.map((fraction) => (
          <line
            key={`border:${fraction}`}
            className={s.cellBorder}
            data-cell-border=""
            x1={OUTLINE_INSET}
            x2={VIEW_BOX_WIDTH - OUTLINE_INSET}
            y1={fraction * VIEW_BOX_HEIGHT}
            y2={fraction * VIEW_BOX_HEIGHT}
          />
        ))}
        {wallFractions.map((fraction) => (
          <line
            key={`wall:${fraction}`}
            className={s.schematicLine}
            data-schematic-line=""
            x1={OUTLINE_INSET}
            x2={VIEW_BOX_WIDTH - OUTLINE_INSET}
            y1={fraction * VIEW_BOX_HEIGHT}
            y2={fraction * VIEW_BOX_HEIGHT}
          />
        ))}
      </g>
    </svg>
  );
};

/**
 * Editor of one column: the tray from the back (1) to the front, with a tap cell for each position, ← back to
 * the presets and Save. A pressed cell holds a U-insert, which puts a wall on each edge of the cell (a cell at
 * the end of the tray gets one, the tray end is the other). The draft is only a preview until Save. Once
 * `maxActive` cells are pressed the others are disabled (C1 R-D); a pressed cell can always be released.
 */
export const PositionsEditor = ({
  positionCount,
  value,
  maxActive,
  layout,
  pulse,
  saving,
  onToggle,
  onBack,
  onSave,
}: PositionsEditorProps) => {
  const hintId = useId();
  const cells = Array.from({ length: positionCount }, (_, index) => index + 1);
  const limitReached = value.length >= maxActive;
  const vertical = layout === "vertical";
  const horizontal = !vertical;

  const backButton = (
    <button type="button" className={s.backButton} aria-label="Back to presets" onClick={onBack}>
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
  );

  const saveButton = (
    <button type="button" className={s.saveButton} aria-busy={saving} data-pulse={pulse} onClick={onSave}>
      Save
      {/* Remounted by the key on each pulse, so the animation restarts and the button keeps its focus. */}
      {pulse > 0 && <span key={pulse} className={s.savePulse} data-save-pulse="" aria-hidden="true" />}
    </button>
  );

  return (
    <div className={s.editor} data-layout={layout}>
      {backButton}
      {/* The strip has room for the counter only: the hint is its title and the description of the tray. */}
      <span className={s.insertCount} data-insert-count="" title={horizontal ? trayHint(maxActive) : undefined}>
        {`Inserts ${value.length} of ${maxActive}`}
      </span>
      {vertical && <span className={s.edgeLabel}>Back</span>}
      <div className={s.tray} role="group" aria-label="Divider positions, back to front" aria-describedby={hintId}>
        <TrayDrawing positionCount={positionCount} value={value} horizontal={horizontal} />
        {cells.map((cell) => {
          const pressed = value.includes(cell);
          return (
            <button
              key={cell}
              type="button"
              className={s.trayCell}
              style={cellBox(cell - 1, positionCount, horizontal)}
              aria-label={`Cell ${cell} of ${positionCount}`}
              aria-pressed={pressed}
              disabled={!pressed && limitReached}
              onClick={() => onToggle(cell)}
            />
          );
        })}
      </div>
      {vertical ? <span className={s.edgeLabel}>Front</span> : <span className={s.edgeLabel}>Back ▸ Front</span>}
      <p id={hintId} className={s.hint}>
        {trayHint(maxActive)}
      </p>
      {saveButton}
    </div>
  );
};
