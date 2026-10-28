/**
 * The `cells-v1` codec of the ROW-MTL-43 profile as the SVG scheme reads it: which of the tray's four
 * divider walls a column's pressed cells turn on. 3D draws the same walls from the same rule
 * (OPUS-C §3.3), and the shared render fixture runs in both repos.
 */

/** Wall_1 … Wall_4: on or off. */
export type WallMask = readonly [w1: boolean, w2: boolean, w3: boolean, w4: boolean];

/** Z of each wall in the 43 cm tray: Wall_1 is next to the facade, Wall_4 next to the back wall. */
export const WALL_Z_CM = [12.78, 4.26, -4.26, -12.78] as const;

const CELLS_V1 = "cells-v1";
const POSITION_COUNT = 5;
const TRAY_LENGTH_CM = 43;

const assertKnownCodec = (codec: string) => {
  if (codec !== CELLS_V1) throw new Error(`Unknown drawer organizer codec: ${codec}`);
};

/**
 * Walls turned on by the pressed cells. Cell `k` (1 = the back cell) puts a U-insert in that cell:
 * k >= 2 turns on Wall_{6-k}, k <= 4 turns on Wall_{5-k}. A value outside 1..5 turns on nothing.
 */
export const wallsOf = (positions: readonly number[], codec: string = CELLS_V1): WallMask => {
  assertKnownCodec(codec);

  const walls: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  for (const k of positions) {
    if (!Number.isInteger(k) || k < 1 || k > POSITION_COUNT) continue;
    if (k >= 2) walls[5 - k] = true;
    if (k <= 4) walls[4 - k] = true;
  }
  return walls;
};

/** Lines of the scheme: the walls that are on, as fractions of the tray length from the back edge, ascending. */
export const schematicLines = (positions: readonly number[], codec: string = CELLS_V1): number[] =>
  wallsOf(positions, codec)
    .flatMap((on, index) => (on ? [(WALL_Z_CM[index] + TRAY_LENGTH_CM / 2) / TRAY_LENGTH_CM] : []))
    .sort((a, b) => a - b);
