import type { CabinetDraftState, CabinetsState } from "@/features/configuratorApi";

/**
 * A side shelf stands at an end of its row, as the classic menus keep it (a shelf is never
 * pushed inward), and never in a column. The scene has no such rule for a free layout, so a draft
 * is checked here before it is applied.
 */

/** A cabinet along the wall: its scene type, the centre of its place (m) and its width (cm). */
export type WallCabinet = { id: string; definitionId: string; centreXM: number; widthCm: number };

/** Cabinets this close (cm) stand in one row. */
const ROW_GAP_CM = 1;
/** Less than this (cm) of overlap is two neighbours touching, not one place. */
const OVERLAP_CM = 0.01;

const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Span = WallCabinet & { from: number; to: number };

const spanOf = (cabinet: WallCabinet): Span => ({
  ...cabinet,
  from: cabinet.centreXM * 100 - cabinet.widthCm / 2,
  to: cabinet.centreXM * 100 + cabinet.widthCm / 2,
});

/** Whether every side shelf stands alone at an end of its row. */
export const sideShelvesAtRowEnds = (
  cabinets: readonly WallCabinet[],
  isSideShelf: (definitionId: string) => boolean,
): boolean => {
  const rows: Span[][] = [];
  for (const span of cabinets.map(spanOf).sort((left, right) => left.from - right.from)) {
    const row = rows.at(-1);
    if (row && span.from <= Math.max(...row.map(({ to }) => to)) + ROW_GAP_CM) row.push(span);
    else rows.push([span]);
  }

  return rows.every((row) =>
    row.every((span) => {
      if (!isSideShelf(span.definitionId)) return true;
      const others = row.filter((other) => other !== span);
      const inColumn = others.some((other) => other.from < span.to - OVERLAP_CM && span.from < other.to - OVERLAP_CM);
      const first = others.every((other) => other.from >= span.to - OVERLAP_CM);
      const last = others.every((other) => other.to <= span.from + OVERLAP_CM);
      return !inColumn && (first || last);
    }),
  );
};

/**
 * The composition as a draft would leave it: the cabinets of `state` with the dragged one at its
 * draft place. Null while the draft does not say where it stands or how wide it is.
 */
export const wallAfterDraft = (state: CabinetsState, draft: CabinetDraftState): WallCabinet[] | null => {
  const candidate = draft.candidate;
  const positionM = candidate?.effectivePlacement?.positionM;
  const selection = candidate?.selection;
  const centreXM = finite(positionM?.x);
  const widthCm = isRecord(selection) ? finite(selection.Width) : null;
  if (!candidate || typeof candidate.definitionId !== "string" || centreXM === null || widthCm === null) return null;

  const movedId = typeof candidate.productId === "string" ? candidate.productId : null;
  const placed = state.cabinets.flatMap((cabinet): WallCabinet[] => {
    const width = finite(cabinet.selection.Width);
    const centre = finite(cabinet.positionM.x);
    if (cabinet.id === movedId || width === null || centre === null) return [];
    return [{ id: cabinet.id, definitionId: cabinet.definitionId, centreXM: centre, widthCm: width }];
  });

  return [...placed, { id: movedId ?? draft.sessionId, definitionId: candidate.definitionId, centreXM, widthCm }];
};
