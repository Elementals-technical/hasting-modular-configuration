import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import { getActiveProductProfile, getDimensionsByCabinet } from "@/entities/configuration/model/store/selectors";
import { getCompositionVersion } from "@/entities/product/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { getCountertopRuntimeState, subscribeCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";
import { SIDE_PANEL_WIDTH_CM } from "@/shared/lib/sku";
import { readSceneSupportGroups } from "@/utils/functions/playcanvas/sceneBridge";

import {
  cabinetRowsKey,
  checkPlusRow,
  fitsCabinetRow,
  maxCabinetRowWidth,
  ONE_CABINET_ROW,
  pickRowEnd,
  resolveCabinetRows,
  type CabinetRowLimits,
  type CabinetRows,
  type PlusAnchor,
  type PlusRowCheck,
  type RowEndCandidate,
} from "../cabinetRows";
import {
  formatCompositionLengthReachedReason,
  REASON_COMPOSITION_LENGTH_REACHED,
  REASON_COMPOSITION_LENGTH_REACHED_NO_MAX,
} from "../lengthLimits";

import type { CountertopLengthGuard } from "./useCountertopLengthGuard";

export type CabinetRowCapacity = {
  /** Whether a cabinet of this type and width fits some row it may go in. */
  fits: (cabinetType: string | null, widthCm: number) => boolean;
  /** The widest cabinet of this type some row can take; null while the countertop cannot be judged. */
  maxWidth: (cabinetType: string | null) => number | null;
  /** Whether a "+" may add this cabinet, by the rows as last read: for the scene's "+" filter. */
  allowsPlus: (plus: PlusAnchor, cabinetType: string | null, widths: readonly number[] | null) => boolean;
  /** Whether a "+" may add this cabinet and in which widths, by the rows read again now: for its click. */
  checkPlus: (plus: PlusAnchor, cabinetType: string | null, widths: readonly number[] | null) => PlusRowCheck;
  /** The row end a cabinet added without a "+" starts at (`pickRowEnd`), by the rows read again now. */
  pickRowEnd: <T extends RowEndCandidate>(
    ends: readonly T[],
    cabinetType: string | null,
    widths: readonly number[] | null,
  ) => T | null;
};

const readCabinetRows = (): CabinetRows => {
  const countertopId = getCountertopRuntimeState()?.productId ?? null;
  return countertopId ? resolveCabinetRows(readSceneSupportGroups(countertopId), SIDE_PANEL_WIDTH_CM) : ONE_CABINET_ROW;
};

/**
 * The countertop length rule, row by row: a cabinet placed in a row the countertop does not rest on (the
 * lower row of an Urban Low Height Multi-Level composition) is judged by that row's own length against the
 * same maximum. Takes the guard the caller already has. The scene's rows are read again whenever the
 * countertop, the composition or a cabinet's size changes; a click reads them once more.
 */
export const useCabinetRowCapacity = (guard: CountertopLengthGuard): CabinetRowCapacity => {
  // The composition and the cabinets' sizes render this again; every render reads the rows anew.
  useAppSelector(getCompositionVersion);
  useAppSelector(getDimensionsByCabinet);
  const profile = useAppSelector(getActiveProductProfile);

  // The same rows read again keep the same value, so a render that changed nothing changes nothing.
  const lastRows = useRef<CabinetRows>(ONE_CABINET_ROW);
  const readRows = useCallback(() => {
    const next = readCabinetRows();
    if (cabinetRowsKey(next) !== cabinetRowsKey(lastRows.current)) lastRows.current = next;
    return lastRows.current;
  }, []);
  const rows = useSyncExternalStore(subscribeCountertopRuntimeState, readRows, readRows);

  const { max, remaining } = guard;
  const limits = useMemo<CabinetRowLimits>(
    () => ({ rows, maxCm: max, countertopRemainingCm: remaining }),
    [max, remaining, rows],
  );

  // Collections without the composition-length message read the text the guard has always shown.
  const withText = useCallback(
    (check: PlusRowCheck): PlusRowCheck => {
      if (check.status === "ok") return check;
      const { code } = check.reason;
      if (code !== REASON_COMPOSITION_LENGTH_REACHED && code !== REASON_COMPOSITION_LENGTH_REACHED_NO_MAX) return check;
      return { ...check, reason: { ...check.reason, text: formatCompositionLengthReachedReason(max, profile) } };
    },
    [max, profile],
  );

  return useMemo<CabinetRowCapacity>(
    () => ({
      fits: (cabinetType, widthCm) => fitsCabinetRow(limits, cabinetType, widthCm),
      maxWidth: (cabinetType) => maxCabinetRowWidth(limits, cabinetType),
      allowsPlus: (plus, cabinetType, widths) => checkPlusRow(limits, plus, cabinetType, widths).status === "ok",
      checkPlus: (plus, cabinetType, widths) =>
        withText(checkPlusRow({ ...limits, rows: readCabinetRows() }, plus, cabinetType, widths)),
      pickRowEnd: (ends, cabinetType, widths) =>
        pickRowEnd({ ...limits, rows: readCabinetRows() }, ends, cabinetType, widths),
    }),
    [limits, withText],
  );
};
