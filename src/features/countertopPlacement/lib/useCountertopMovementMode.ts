import { useCallback, useEffect, useRef, useState } from "react";

import { getActiveCountertopThickness } from "@/entities/product/model/store/selectors";
import { parseThicknessValue } from "@/features/configurator-rule-core/countertop";
import { classifyCountertopError, isStandardCountertop, type CountertopApi } from "@/features/configuratorApi";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import { getCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

/** 'none': stays Standard; 'offset': slides left/right only (locked); 'free': slides and lifts. */
export type CountertopMovementMode = "none" | "offset" | "free";

const METRES_PER_INCH = 0.0254;
// The options are far apart; a 4″ mesh may measure as 0.1 m (3.94″).
const THICKNESS_TOLERANCE_IN = 0.25;
/** Thin slabs (0.375 / 0.4 / 0.5″) never move. */
const THIN_BELOW_IN = 1;
const OFFSET_ONLY_IN = 4;
const FREE_THICKNESSES_IN = [2.4, 5.125, 5.5];
/** A top higher than this (metres) counts as lifted. */
const LIFTED_ABOVE_M = 0.01;

const MODE_NOTICE: Record<CountertopMovementMode, string> = {
  none: "countertop.mode.none",
  offset: "countertop.mode.offset",
  free: "countertop.mode.free",
};

/**
 * Movement mode of the top by its thickness: the selected `Thickness` option (inches) first,
 * the runtime `state.thickness` (metres) when the option is unset. `null` when unknown.
 */
export const resolveMovementMode = (
  thicknessOption: string | null | undefined,
  runtimeThicknessM?: number | null,
): CountertopMovementMode | null => {
  const selectedIn = thicknessOption ? parseThicknessValue(thicknessOption) : null;
  const runtimeIn =
    typeof runtimeThicknessM === "number" && Number.isFinite(runtimeThicknessM) && runtimeThicknessM > 0
      ? runtimeThicknessM / METRES_PER_INCH
      : null;
  const thicknessIn = selectedIn !== null && selectedIn > 0 ? selectedIn : runtimeIn;
  if (thicknessIn === null) return null;
  if (thicknessIn < THIN_BELOW_IN) return "none";
  const near = (value: number) => Math.abs(thicknessIn - value) < THICKNESS_TOLERANCE_IN;
  if (near(OFFSET_ONLY_IN)) return "offset";
  return FREE_THICKNESSES_IN.some(near) ? "free" : null;
};

export type CountertopModeNoticeState = {
  /** UI_REASON_TEXTS codes, joined into one message. */
  codes: string[];
  /** Neither the auto-correction nor its reset went through. */
  failure: { code?: string; text: string } | null;
};

const isTransient = (error: unknown) => {
  const { kind } = classifyCountertopError(error);
  return kind === "not-ready" || kind === "busy";
};

/** Lower an offset-only top (falls back to Standard), or reset a thin one. */
const correctPose = async (api: CountertopApi, mode: "offset" | "none"): Promise<"lowered" | "reset"> => {
  if (mode === "offset") {
    try {
      await api.setOffset({ x: getCountertopRuntimeState()?.offset?.x ?? 0, y: 0 });
      // Landed 'fits' over another sink cabinet: that is a sink move, not a lowering ('home' 3D settles itself).
      const pending = (await api.getState())?.sink?.pending;
      if (!pending || pending.status === "home") return "lowered";
    } catch (error) {
      if (isTransient(error)) throw error;
      // COUNTERTOP_POSE_INVALID: the sink would sit on a seam / gap / the wrong cabinet.
    }
  }
  await api.resetOffset();
  return "reset";
};

/**
 * Keeps the top's movement in step with its thickness, in one place: `setVerticalLocked`,
 * the auto-correction of a pose the mode forbids (one attempt per violation, never mid-drag)
 * and a short notice on every switch between two known modes of the same top.
 */
export const useCountertopMovementMode = (getApi: () => CountertopApi | null, ready: boolean) => {
  const thicknessOption = useAppSelector(getActiveCountertopThickness);
  // Primitives only: this hook runs in PlayCanvasIntegration, which must not re-render on drag frames.
  const thicknessM = useCountertopRuntimeValue((state) => state?.thickness ?? null);
  const topReady = useCountertopRuntimeValue((state) => state?.readiness === "ready") && ready;
  const locked = useCountertopRuntimeValue((state) => state?.verticalLocked === true);
  const target = useCountertopRuntimeValue((state) => `${state?.productId ?? ""}|${state?.compositionId ?? ""}`);
  const lifted = useCountertopRuntimeValue((state) => (state?.offset?.y ?? 0) > LIFTED_ABOVE_M);
  const standard = useCountertopRuntimeValue((state) => isStandardCountertop(state));
  const dragging = useCountertopRuntimeValue((state) => state?.dragging === true);
  const mode = resolveMovementMode(thicknessOption, thicknessM);

  const [notice, setNotice] = useState<CountertopModeNoticeState | null>(null);
  const show = useCallback(
    (codes: string[], failure: CountertopModeNoticeState["failure"] = null) => setNotice({ codes, failure }),
    [],
  );
  const dismissNotice = useCallback(() => setNotice(null), []);

  const correction = mode === "offset" && lifted ? "offset" : mode === "none" && !standard ? "none" : null;
  const lastModeRef = useRef<{ target: string; mode: CountertopMovementMode } | null>(null);
  const switchedToRef = useRef<CountertopMovementMode | null>(null);
  const correctedRef = useRef<string | null>(null);
  useEffect(() => {
    // Not while the top is (re)binding: a transient empty target would swallow the switch notice.
    if (mode === null || !topReady) return;
    const previous = lastModeRef.current;
    if (previous?.target === target && previous.mode === mode) return;
    lastModeRef.current = { target, mode };
    // First load, or another top / composition / preset: not a switch, no notice.
    if (previous?.target !== target) return;
    // The correction notice that follows this switch repeats the mode text, once.
    switchedToRef.current = correction === mode ? mode : null;
    // The notice answers a runtime / Redux transition seen only here (one render per switch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    show([MODE_NOTICE[mode]]);
  }, [correction, mode, show, target, topReady]);

  const wantedLock = mode === "offset" ? true : mode === "free" ? false : null;
  const lockKey = `${target}|${wantedLock}`;
  const pendingRef = useRef<string | null>(null);
  const failedRef = useRef<string | null>(null);
  useEffect(() => {
    // Another wanted value or top: an earlier failure must not block this one (4 → 5½ → 4 → 5½).
    if (failedRef.current !== lockKey) failedRef.current = null;
    if (!topReady || wantedLock === null || locked === wantedLock) return;
    const api = getApi();
    const setVerticalLocked = api?.setVerticalLocked;
    if (!api || typeof setVerticalLocked !== "function") return;
    if (pendingRef.current === lockKey || failedRef.current === lockKey) return;
    pendingRef.current = lockKey;
    void Promise.resolve()
      .then(() => setVerticalLocked.call(api, wantedLock))
      .catch((error: unknown) => {
        if (isTransient(error)) return;
        // A UI bug (bad input) or an unknown failure: do not hammer the runtime for this key.
        failedRef.current = lockKey;
        console.warn("[countertop] setVerticalLocked failed", classifyCountertopError(error));
      })
      .finally(() => {
        if (pendingRef.current === lockKey) pendingRef.current = null;
      });
  }, [getApi, locked, lockKey, topReady, wantedLock]);

  const correctionKey = `${target}|${correction}`;
  useEffect(() => {
    if (correction === null) {
      // The pose is allowed: a later violation (a restored snapshot, a preset) earns a new attempt.
      correctedRef.current = null;
      switchedToRef.current = null; // nothing left to correct after the switch
      return;
    }
    if (!topReady || dragging || correctedRef.current === correctionKey) return;
    const api = getApi();
    if (!api) return;
    correctedRef.current = correctionKey;
    const afterSwitch = switchedToRef.current === correction;
    switchedToRef.current = null; // shown once, with this correction
    const withSwitch = (codes: string[]) => (afterSwitch ? [MODE_NOTICE[correction], ...codes] : codes);
    correctPose(api, correction).then(
      (outcome) => show(withSwitch([outcome === "lowered" ? "countertop.mode.lowered" : "countertop.mode.reset"])),
      (error: unknown) => {
        if (isTransient(error)) {
          if (correctedRef.current === correctionKey) correctedRef.current = null;
          return;
        }
        const { code, reasons, message } = classifyCountertopError(error);
        show(withSwitch([]), { code: reasons[0] ?? code ?? undefined, text: message });
      },
    );
  }, [correction, correctionKey, dragging, getApi, show, topReady]);

  return { mode, notice, dismissNotice };
};
