import type { WallCabinet } from "./sideShelfEdges";

/**
 * Every sink base of a composition stands in one row, as the builder's "+" keeps them (a Sink Base
 * goes only in the row the countertop rests on). The scene has no such rule for a free layout, so a
 * draft is checked here before it is applied.
 *
 * A row is read as the scene reads it (groupCabinetRows): one level band along the wall, split where
 * the cabinets stop touching.
 */

/** Cabinets whose level differs by no more than this (m) stand on one plane. */
const LEVEL_TOLERANCE_M = 0.005;
/** Cabinets this close (cm) stand in one row. */
const ROW_GAP_CM = 1;

type Span = WallCabinet & { from: number; to: number };

const spanOf = (cabinet: WallCabinet): Span => ({
  ...cabinet,
  from: cabinet.centreXM * 100 - cabinet.widthCm / 2,
  to: cabinet.centreXM * 100 + cabinet.widthCm / 2,
});

/** The rows of a composition: level bands first, then the runs of touching cabinets inside each band. */
const rowsOf = (cabinets: readonly WallCabinet[]): Span[][] => {
  const bands: Span[][] = [];
  let lastLevelYM: number | null = null;
  for (const span of cabinets
    .map(spanOf)
    .sort((left, right) => left.levelYM - right.levelYM || left.from - right.from)) {
    const band = bands.at(-1);
    if (band && lastLevelYM !== null && Math.abs(span.levelYM - lastLevelYM) <= LEVEL_TOLERANCE_M) band.push(span);
    else bands.push([span]);
    lastLevelYM = span.levelYM;
  }

  return bands.flatMap((band) => {
    const rows: Span[][] = [];
    for (const span of [...band].sort((left, right) => left.from - right.from)) {
      const row = rows.at(-1);
      if (row && span.from <= Math.max(...row.map(({ to }) => to)) + ROW_GAP_CM) row.push(span);
      else rows.push([span]);
    }
    return rows;
  });
};

/** Whether the sink bases of a composition all stand in one row; true while it holds at most one. */
export const sinkBasesInOneRow = (
  cabinets: readonly WallCabinet[],
  isSinkBase: (definitionId: string) => boolean,
): boolean => rowsOf(cabinets).filter((row) => row.some(({ definitionId }) => isSinkBase(definitionId))).length <= 1;
