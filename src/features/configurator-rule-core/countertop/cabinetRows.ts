import type { Reason } from "@/shared/lib/reasonText";
import { cmToInches } from "@/shared/lib/sku/cmToInches";
import type { ScenePlusKind, SceneSupportGroups } from "@/utils/functions/playcanvas/sceneBridge";

import { compositionLengthReachedReason } from "./lengthLimits";

/**
 * Rows of a composition on more than one level (Urban Low Height Multi-Level). The countertop rests on
 * one row; every other row has a support group of its own, and the scene does not lengthen the countertop
 * for a cabinet placed there. The length rule judges each row on its own against the same maximum, and a
 * Sink Base stays in the countertop's row, beside the other Sink Bases.
 */

export const REASON_ROW_LENGTH_REACHED = "countertop.rowLengthReached";
export const REASON_SINK_BASE_IN_COUNTERTOP_ROW = "cabinet.sinkBaseInCountertopRow";

const SINK_BASE = "Sink-Base";
/** The tolerance useCountertopLengthGuard allows. */
const EPSILON_CM = 0.01;

/** A row the countertop does not rest on, and its length with the side panels at its ends. */
export type OtherCabinetRow = { groupId: string; lengthCm: number };

export type CabinetRows = {
  /** The countertop's support group; null when the composition is judged as one row. */
  countertopGroupId: string | null;
  groupOfCabinet: Readonly<Record<string, string>>;
  otherRows: readonly OtherCabinetRow[];
};

export const ONE_CABINET_ROW: CabinetRows = { countertopGroupId: null, groupOfCabinet: {}, otherRows: [] };

/**
 * The rows the scene lays out. Columns (Urban Duplex) and a single row keep the countertop's rule for every
 * placement, and so does a read that cannot tell the rows apart: no cabinet in the countertop's group, or a
 * cabinet of another row without a width. A row's length is its cabinets' widths and its side panels.
 */
export const resolveCabinetRows = (read: SceneSupportGroups | null, sidePanelWidthCm: number): CabinetRows => {
  if (!read || read.layout !== "rows") return ONE_CABINET_ROW;
  if (!read.cabinets.some(({ supportGroupId }) => supportGroupId === read.countertopGroupId)) return ONE_CABINET_ROW;

  const cabinetsCm = new Map<string, number>();
  for (const { supportGroupId, widthCm } of read.cabinets) {
    if (supportGroupId === read.countertopGroupId) continue;
    if (widthCm === null) return ONE_CABINET_ROW;
    cabinetsCm.set(supportGroupId, (cabinetsCm.get(supportGroupId) ?? 0) + widthCm);
  }

  return {
    countertopGroupId: read.countertopGroupId,
    groupOfCabinet: Object.fromEntries(read.cabinets.map(({ id, supportGroupId }) => [id, supportGroupId])),
    otherRows: [...cabinetsCm].map(([groupId, lengthCm]) => ({
      groupId,
      lengthCm: lengthCm + (read.sidePanelsByGroup[groupId] ?? 0) * sidePanelWidthCm,
    })),
  };
};

/** Changes only when a row's group or length does, so a re-read of the same rows keeps the same value. */
export const cabinetRowsKey = ({ countertopGroupId, groupOfCabinet, otherRows }: CabinetRows): string =>
  JSON.stringify([countertopGroupId, Object.entries(groupOfCabinet).sort(), otherRows]);

/** What a cabinet is judged against: the rows, the maximum and the countertop row's remaining length. */
export type CabinetRowLimits = {
  rows: CabinetRows;
  maxCm: number | null;
  /** useCountertopLengthGuard's `remaining`: null while the countertop cannot be judged. */
  countertopRemainingCm: number | null;
};

/** The other rows a cabinet type may go in, with the room each has left; a Sink Base goes in none of them. */
const roomsInOtherRows = ({ rows, maxCm }: CabinetRowLimits, cabinetType: string | null): number[] =>
  cabinetType === SINK_BASE || maxCm === null ? [] : rows.otherRows.map(({ lengthCm }) => maxCm - lengthCm);

/** Whether a cabinet of this width fits some row it may go in; permissive while the countertop cannot be judged. */
export const fitsCabinetRow = (limits: CabinetRowLimits, cabinetType: string | null, widthCm: number): boolean => {
  const remaining = limits.countertopRemainingCm;
  if (remaining === null || widthCm <= remaining + EPSILON_CM) return true;

  return roomsInOtherRows(limits, cabinetType).some((room) => widthCm <= room + EPSILON_CM);
};

/** The widest cabinet of this type some row can take; null while the countertop cannot be judged. */
export const maxCabinetRowWidth = (limits: CabinetRowLimits, cabinetType: string | null): number | null => {
  const remaining = limits.countertopRemainingCm;
  if (remaining === null) return null;

  return Math.max(0, remaining, ...roomsInOtherRows(limits, cabinetType));
};

/** A scene "+": the cabinet it stands by and its kind. */
export type PlusAnchor = { cabinetId: string; kind: ScenePlusKind };

/** Where the cabinet a "+" adds ends up. */
export type PlusRow = { kind: "countertop" } | { kind: "other"; row: OtherCabinetRow } | { kind: "under" };

export const plusRowOf = (rows: CabinetRows, { cabinetId, kind }: PlusAnchor): PlusRow => {
  // A column's free bottom place stands under a hanging cabinet: the countertop above it does not get longer.
  if (kind === "bottom") return { kind: "under" };
  if (kind !== "left" && kind !== "right") return { kind: "countertop" };

  const groupId = rows.groupOfCabinet[cabinetId];
  const row =
    groupId === undefined || groupId === rows.countertopGroupId
      ? undefined
      : rows.otherRows.find((item) => item.groupId === groupId);
  return row ? { kind: "other", row } : { kind: "countertop" };
};

export type PlusRowCheck =
  | { status: "ok"; limitCm: number | null; widths: readonly number[] | null }
  | { status: "refused"; reason: Reason };

/**
 * Whether the cabinet a "+" adds may go there, and the widths that fit. A Sink Base goes only in the
 * countertop's row. The countertop's row takes what its remaining length allows, another row the same
 * maximum less its own length, a column's bottom place any width. `widths` null: the width is not known
 * yet, so only the row is judged.
 */
export const checkPlusRow = (
  limits: CabinetRowLimits,
  plus: PlusAnchor,
  cabinetType: string | null,
  widths: readonly number[] | null,
): PlusRowCheck => {
  const row = plusRowOf(limits.rows, plus);
  if (row.kind !== "countertop" && cabinetType === SINK_BASE) {
    return { status: "refused", reason: { code: REASON_SINK_BASE_IN_COUNTERTOP_ROW } };
  }

  const { maxCm } = limits;
  const limitCm =
    row.kind === "under"
      ? null
      : row.kind === "other"
        ? maxCm === null
          ? null
          : maxCm - row.row.lengthCm
        : limits.countertopRemainingCm;
  if (limitCm === null || widths === null) return { status: "ok", limitCm, widths };

  const fitting = widths.filter((width) => width <= limitCm + EPSILON_CM);
  if (fitting.length > 0) return { status: "ok", limitCm, widths: fitting };

  return {
    status: "refused",
    reason:
      row.kind === "other" && maxCm !== null
        ? { code: REASON_ROW_LENGTH_REACHED, params: { maxCm, maxIn: cmToInches(maxCm) } }
        : compositionLengthReachedReason(maxCm),
  };
};

/** A row end a cabinet may start at, where the scene offers one, and how far along the wall it stands (m). */
export type RowEndCandidate = PlusAnchor & { x: number };

/**
 * The row end a cabinet added without a "+" starts at (Drag to Place), by the rule of the "+": a Sink Base
 * in the countertop's row, another type in a row with room for its width. The right end of the countertop's
 * row comes first, then another row's, then the left ends. A row its width does not fit is taken only when
 * none fits. Null for a composition judged as one row (one row, columns): the scene's own choice stands.
 */
export const pickRowEnd = <T extends RowEndCandidate>(
  limits: CabinetRowLimits,
  ends: readonly T[],
  cabinetType: string | null,
  widths: readonly number[] | null,
): T | null => {
  if (limits.rows.countertopGroupId === null) return null;

  const ranked = ends
    .filter(
      (end) =>
        (end.kind === "left" || end.kind === "right") && checkPlusRow(limits, end, cabinetType, null).status === "ok",
    )
    .map((end) => ({
      end,
      fits: widths === null || checkPlusRow(limits, end, cabinetType, widths).status === "ok",
      right: end.kind === "right",
      countertop: plusRowOf(limits.rows, end).kind === "countertop",
    }))
    .sort(
      (a, b) =>
        Number(b.fits) - Number(a.fits) ||
        Number(b.right) - Number(a.right) ||
        Number(b.countertop) - Number(a.countertop) ||
        (a.right ? b.end.x - a.end.x : a.end.x - b.end.x),
    );

  return ranked[0]?.end ?? null;
};
