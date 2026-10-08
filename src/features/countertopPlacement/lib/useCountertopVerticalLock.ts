import { useEffect, useRef } from "react";

import { getActiveCountertopThickness } from "@/entities/product/model/store/selectors";
import { parseThicknessValue } from "@/features/configurator-rule-core/countertop";
import { classifyCountertopError, type CountertopApi } from "@/features/configuratorApi";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";

/** Client rule: a 4″ top is offset-only (slides left/right, never lifts); 5-⅛″ and 5-½″ may lift. */
export const OFFSET_ONLY_THICKNESS_IN = 4;
const METRES_PER_INCH = 0.0254;
// 4 / 5-1/8 / 5-1/2 are far apart; a 4″ mesh may measure as 0.1 m (3.94″).
const THICKNESS_TOLERANCE_IN = 0.25;

/**
 * Whether the top must be vertically locked: the selected `Thickness` option (inches) first,
 * the runtime `state.thickness` (metres) when the option is unset. `null` while neither is known.
 */
export const resolveVerticalLock = (
  thicknessOption: string | null | undefined,
  runtimeThicknessM?: number | null,
): boolean | null => {
  const selectedIn = thicknessOption ? parseThicknessValue(thicknessOption) : null;
  const runtimeIn =
    typeof runtimeThicknessM === "number" && Number.isFinite(runtimeThicknessM) && runtimeThicknessM > 0
      ? runtimeThicknessM / METRES_PER_INCH
      : null;
  const thicknessIn = selectedIn ?? runtimeIn;
  return thicknessIn === null ? null : Math.abs(thicknessIn - OFFSET_ONLY_THICKNESS_IN) < THICKNESS_TOLERANCE_IN;
};

/**
 * Keeps `countertop.setVerticalLocked` in step with the top's thickness: called when the top is
 * ready and whenever the wanted lock differs from `state.verticalLocked`. Older runtimes without
 * the method are left alone; `not-ready` / `busy` retry on the next ready state.
 */
export const useCountertopVerticalLock = (getApi: () => CountertopApi | null, ready: boolean): void => {
  const thicknessOption = useAppSelector(getActiveCountertopThickness);
  // Primitives only: this hook runs in PlayCanvasIntegration, which must not re-render on drag frames.
  const thicknessM = useCountertopRuntimeValue((state) => state?.thickness ?? null);
  const topReady = useCountertopRuntimeValue((state) => state?.readiness === "ready") && ready;
  const locked = useCountertopRuntimeValue((state) => state?.verticalLocked === true);
  const target = useCountertopRuntimeValue((state) => `${state?.productId ?? ""}|${state?.compositionId ?? ""}`);
  const wanted = resolveVerticalLock(thicknessOption, thicknessM);
  const pendingRef = useRef<string | null>(null);
  const failedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!topReady || wanted === null || locked === wanted) return;
    const api = getApi();
    const setVerticalLocked = api?.setVerticalLocked;
    if (!api || typeof setVerticalLocked !== "function") return;
    const key = `${target}|${wanted}`;
    if (pendingRef.current === key || failedRef.current === key) return;
    pendingRef.current = key;
    void Promise.resolve()
      .then(() => setVerticalLocked.call(api, wanted))
      .catch((error: unknown) => {
        const failure = classifyCountertopError(error);
        if (failure.kind === "not-ready" || failure.kind === "busy") return;
        // A UI bug (bad input) or an unknown failure: do not hammer the runtime on every change.
        failedRef.current = key;
        console.warn("[countertop] setVerticalLocked failed", failure);
      })
      .finally(() => {
        if (pendingRef.current === key) pendingRef.current = null;
      });
  }, [getApi, locked, target, topReady, wanted]);
};
