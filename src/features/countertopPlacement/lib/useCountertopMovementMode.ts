import { useCallback, useEffect, useRef, useState } from "react";

import type { ProductProfile } from "@/entities/collection";
import { getActiveCountertopThickness } from "@/entities/product/model/store/selectors";
import { findThicknessOption, parseThicknessValue } from "@/features/configurator-rule-core/countertop";
import {
  classifyCountertopError,
  isLiftedCountertop,
  isStandardCountertop,
  type CountertopApi,
} from "@/features/configuratorApi";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import { getCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

import { commitHostedSinkLanding } from "./hostedSinkLanding";

/** 'none': stays Standard; 'offset': slides left/right only (locked); 'free': slides and lifts. */
export type CountertopMovementMode = "none" | "offset" | "free";

const METRES_PER_INCH = 0.0254;
// A mesh may measure off its option (a 4″ top as 0.1 m, 3.94″): the nearest option this close is the top's.
const THICKNESS_TOLERANCE_IN = 0.25;

const MODE_NOTICE: Record<CountertopMovementMode, string> = {
  none: "countertop.mode.none",
  offset: "countertop.mode.offset",
  free: "countertop.mode.free",
};

/** The selected `Thickness` option (inches) first, the runtime `state.thickness` (metres) when the option is unset. */
const resolveThicknessIn = (thicknessOption: string | null | undefined, runtimeThicknessM?: number | null) => {
  const selectedIn = thicknessOption ? parseThicknessValue(thicknessOption) : null;
  const runtimeIn =
    typeof runtimeThicknessM === "number" && Number.isFinite(runtimeThicknessM) && runtimeThicknessM > 0
      ? runtimeThicknessM / METRES_PER_INCH
      : null;
  return selectedIn !== null && selectedIn > 0 ? selectedIn : runtimeIn;
};

/** The collection's Thickness option of the top (`resolveThicknessIn`), whose capabilities say how it moves. */
const resolveThicknessOption = (
  profile: ProductProfile | null | undefined,
  thicknessOption: string | null | undefined,
  runtimeThicknessM?: number | null,
) => {
  const thicknessIn = resolveThicknessIn(thicknessOption, runtimeThicknessM);
  return thicknessIn === null ? null : findThicknessOption(profile, thicknessIn, THICKNESS_TOLERANCE_IN);
};

/**
 * Movement mode of the top by its Thickness option's capabilities: `countertopLifts` → free, `countertopSlides`
 * → offset, neither → none. `null` when the thickness is unknown or no option of the collection is near it.
 */
export const resolveMovementMode = (
  profile: ProductProfile | null | undefined,
  thicknessOption: string | null | undefined,
  runtimeThicknessM?: number | null,
): CountertopMovementMode | null => {
  const option = resolveThicknessOption(profile, thicknessOption, runtimeThicknessM);
  if (!option) return null;
  if (option.capabilities?.countertopLifts) return "free";
  return option.capabilities?.countertopSlides ? "offset" : "none";
};

/** A top whose Thickness option declares `countertopLengthResize`: its length changes from the menu. */
export const isLengthResizableThickness = (
  profile: ProductProfile | null | undefined,
  thicknessOption: string | null | undefined,
  runtimeThicknessM?: number | null,
): boolean =>
  resolveThicknessOption(profile, thicknessOption, runtimeThicknessM)?.capabilities?.countertopLengthResize === true;

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

/** Lower an offset-only top (falls back to Standard), or reset one that never moves. */
const correctPose = async (api: CountertopApi, mode: "offset" | "none"): Promise<"lowered" | "reset"> => {
  if (mode === "offset") {
    try {
      await api.setOffset({ x: getCountertopRuntimeState()?.offset?.x ?? 0, y: 0 });
      // The scene may take the lowered pose back after its checks (a sink base the top would not cover):
      // a top still up is not lowered, and goes to Standard as a pose refused outright.
      await api.whenSettled();
      const state = await api.getState();
      if (!isLiftedCountertop(state)) {
        // Landed 'fits' over another sink cabinet: that is a sink move, not a lowering ('home' 3D settles itself).
        const pending = state?.sink?.pending;
        if (!pending || pending.status === "home") return "lowered";
        // A hosted sink over an SC: the lowering is its landing (`landSink`), not a pose to undo.
        if (await commitHostedSinkLanding(api)) return "lowered";
      }
    } catch (error) {
      if (isTransient(error)) throw error;
      // COUNTERTOP_POSE_INVALID: the sink would sit on a seam / gap / the wrong cabinet.
    }
  }
  await api.resetOffset();
  // As Position ▸ Standard: a hosted sink the reset brings over a cabinet lands there (`landSink`); the scene does
  // not land it on its own, and the top would keep it at the standard pose.
  await api.whenSettled();
  await commitHostedSinkLanding(api);
  return "reset";
};

/**
 * Keeps the top's movement in step with its thickness, in one place: `setVerticalLocked`,
 * the auto-correction of a pose the mode forbids (one attempt per violation, never mid-drag)
 * and a short notice on every switch between two known modes of the same top. What each
 * thickness may do comes from the collection's profile (`profile`).
 */
export const useCountertopMovementMode = (
  getApi: () => CountertopApi | null,
  ready: boolean,
  profile: ProductProfile | null,
) => {
  const thicknessOption = useAppSelector(getActiveCountertopThickness);
  // Primitives only: this hook runs in PlayCanvasIntegration, which must not re-render on drag frames.
  const thicknessM = useCountertopRuntimeValue((state) => state?.thickness ?? null);
  const topReady = useCountertopRuntimeValue((state) => state?.readiness === "ready") && ready;
  const locked = useCountertopRuntimeValue((state) => state?.verticalLocked === true);
  const target = useCountertopRuntimeValue((state) => `${state?.productId ?? ""}|${state?.compositionId ?? ""}`);
  const lifted = useCountertopRuntimeValue((state) => isLiftedCountertop(state));
  const standard = useCountertopRuntimeValue((state) => isStandardCountertop(state));
  const dragging = useCountertopRuntimeValue((state) => state?.dragging === true);
  const mode = resolveMovementMode(profile, thicknessOption, thicknessM);
  const lengthResizable = isLengthResizableThickness(profile, thicknessOption, thicknessM);

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
  // An attempt in flight: the poses it passes through (lowered, then taken back by the scene) are not new violations.
  const correctingRef = useRef(false);
  useEffect(() => {
    if (correction === null) {
      // The pose is allowed: a later violation (a restored snapshot, a preset) earns a new attempt.
      if (!correctingRef.current) correctedRef.current = null;
      switchedToRef.current = null; // nothing left to correct after the switch
      return;
    }
    if (!topReady || dragging || correctingRef.current || correctedRef.current === correctionKey) return;
    const api = getApi();
    if (!api) return;
    correctedRef.current = correctionKey;
    correctingRef.current = true;
    const afterSwitch = switchedToRef.current === correction;
    switchedToRef.current = null; // shown once, with this correction
    const withSwitch = (codes: string[]) => (afterSwitch ? [MODE_NOTICE[correction], ...codes] : codes);
    correctPose(api, correction)
      .then(
        (outcome) => {
          // The pose it ended in is allowed: a later violation earns a new attempt.
          correctedRef.current = null;
          show(withSwitch([outcome === "lowered" ? "countertop.mode.lowered" : "countertop.mode.reset"]));
        },
        (error: unknown) => {
          if (isTransient(error)) {
            if (correctedRef.current === correctionKey) correctedRef.current = null;
            return;
          }
          const { code, reasons, message } = classifyCountertopError(error);
          show(withSwitch([]), { code: reasons[0] ?? code ?? undefined, text: message });
        },
      )
      .finally(() => {
        correctingRef.current = false;
      });
  }, [correction, correctionKey, dragging, getApi, show, topReady]);

  return { mode, lengthResizable, notice, dismissNotice };
};
