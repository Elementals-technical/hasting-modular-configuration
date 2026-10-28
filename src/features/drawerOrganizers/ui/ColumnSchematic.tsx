import { schematicLines } from "../model/cellsCodec";

import s from "./DividerOptionsPanel.module.scss";

/** The tray of one column in viewBox units: 10 units per cm of the 43 cm tray, 10 cm wide. Shared with PositionsEditor. */
export const VIEW_BOX_WIDTH = 100;
export const VIEW_BOX_HEIGHT = 430;
/** The tray outline is drawn inside the viewBox, so its stroke is not cut at the edge. */
export const OUTLINE_INSET = 3;

export type ColumnSchematicProps = {
  /** Pressed cells of the column, 1 = the back cell. */
  positions: readonly number[];
  /** Material of the column (`Metal` | `Oak`): the stylesheet colours the lines by it. */
  style: string;
  /** Height in px; the width follows the proportions of the tray. */
  size: number;
};

/**
 * Top view of one column's tray with the divider walls the pressed cells turn on: the back wall of the
 * drawer is at the top, the facade at the bottom. The lines come from the same codec 3D draws from
 * (`schematicLines`), so a card and the 3D view show the same walls.
 *
 * Example: `<ColumnSchematic positions={[1, 4]} style="Metal" size={86} />` draws three lines.
 */
export const ColumnSchematic = ({ positions, style, size }: ColumnSchematicProps) => {
  // 1. Walls to draw, as fractions of the tray length from the back edge.
  const lineFractions = schematicLines(positions);

  return (
    <svg
      className={s.schematic}
      data-style={style}
      viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
      width={(size * VIEW_BOX_WIDTH) / VIEW_BOX_HEIGHT}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className={s.schematicTray}
        x={OUTLINE_INSET}
        y={OUTLINE_INSET}
        width={VIEW_BOX_WIDTH - 2 * OUTLINE_INSET}
        height={VIEW_BOX_HEIGHT - 2 * OUTLINE_INSET}
        rx={6}
      />
      {/* 2. One line per wall that is on. */}
      {lineFractions.map((fraction) => {
        const y = fraction * VIEW_BOX_HEIGHT;
        return (
          <line
            key={fraction}
            className={s.schematicLine}
            data-schematic-line=""
            x1={OUTLINE_INSET}
            x2={VIEW_BOX_WIDTH - OUTLINE_INSET}
            y1={y}
            y2={y}
          />
        );
      })}
    </svg>
  );
};
