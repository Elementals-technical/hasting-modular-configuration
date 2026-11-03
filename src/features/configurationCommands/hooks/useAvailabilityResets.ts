import { useEffect, useMemo, useRef } from "react";

import type { RootState } from "@/app/store";
import { selectInitialValue } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration";
import { getIsRestoreOrUndoRunning } from "@/entities/history/model/store/selectors";
import {
  getActiveCountertopColor,
  getBookMatching,
  getCountertopStyle,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import {
  resolveBasinAvailability,
  resolveCountertopStyleAvailability,
  useCountertopRuleState,
} from "@/features/collectionCustomization";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { resolveDefaultBasinForCountertopSelection } from "@/shared/lib/sku";

import { findSinkBaseKey } from "../lib/isSinkBase";
import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import type { ChangeResult } from "../model/types";
import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

const warnIfNotReset = (attributeId: string) => (result: ChangeResult) => {
  if (result.status !== "applied") {
    console.warn(`[useAvailabilityResets] ${attributeId} was not reset`, result);
  }
};

const isVessel = (style: string | null | undefined) => style?.trim().toLowerCase() === "vessel";

const hasSinkBase = (state: RootState) => findSinkBaseKey(state) !== undefined;

/**
 * Clears fluting, grain direction and book matching while the rules make them unavailable, and
 * leaves a vessel countertop the rules refuse for the first style they allow.
 *
 * This is the one owner of these resets: the command records the cleared value and, for fluting
 * and grain, the runtime bindings decide what a cleared value is for the scene ("None" for
 * fluting). Fluting and grain run again when the cabinets change, so a cabinet added meanwhile
 * is cleared too; with no cabinet placed there is nothing to address yet. Book matching is never
 * shown by the scene, so it is cleared without waiting for it. A restore or undo sets these
 * values in several steps, so nothing is cleared until it finishes. Mounted once, for both flows.
 *
 * A vessel is refused below the matrix's vessel Sink Base minimum, so the style resets from any
 * step once the Sink Base shrinks; otherwise the cutout would be priced with no basin it could hold.
 * A basin step picks a basin only while it is open, and not every collection's does, so the basin
 * is set here too: the material's default basin where the matrix allows it, else the first one it
 * allows for the new style. With no other style allowed (no matrix at all) the vessel stays.
 */
export const useAvailabilityResets = ({ runtime }: UseChangeAttributeOptions = {}) => {
  const { change, getState } = useChangeAttribute({ runtime });
  const isSceneReady = usePlayCanvasReady();
  const profile = useAppSelector(getActiveProductProfile);
  const isRestoring = useAppSelector(getIsRestoreOrUndoRunning);
  const isFlutingAvailable = useAppSelector(selectFlutingState).available;
  const isGrainAvailable = useAppSelector(selectGrainDirectionState).available;
  const isBookMatchingEnabled = useAppSelector(selectBookMatchingState).enabled;
  const bookMatching = useAppSelector(getBookMatching);
  const cabinetKeys = useAppSelector((state) =>
    getCabinetEntries(state)
      .map(({ runtimeId }) => runtimeId)
      .join("|"),
  );
  const countertopRuleState = useCountertopRuleState();
  const countertopStyle = useAppSelector(getCountertopStyle);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const sinkType = useAppSelector(getSinkType);
  const isSinkBasePlaced = useAppSelector(hasSinkBase);
  // While the top hosts the basin off its Sink Base the scene cannot change the style or the basin.
  const isSinkHosted = useCountertopRuntimeValue((state) => state?.sink?.hosted === true);
  // Set when the style reset is sent and taken by the basin reset once the new style is recorded.
  const isBasinOwedRef = useRef(false);

  const isVesselStyle = isVessel(countertopStyle);
  const nextStyle =
    isVesselStyle && !countertopRuleState.styleAvailability.vessel.isAvailable
      ? resolveCountertopStyleAvailability(countertopRuleState).allowedValues?.find((style) => !isVessel(style))
      : undefined;
  // The basin an integrated top takes, as the countertop step picks it: none while the current one is allowed.
  const nextBasin = useMemo(() => {
    if (isVesselStyle) return undefined;
    const { allowedValues = [] } = resolveBasinAvailability(
      profile,
      countertopRuleState,
      countertopStyle,
      countertopColor,
    );
    if (allowedValues.includes(sinkType)) return undefined;
    const defaultBasin = resolveDefaultBasinForCountertopSelection({
      countertopColor,
      materialTokens: countertopRuleState.activeMaterialTokens,
    });
    return defaultBasin && allowedValues.includes(defaultBasin) ? defaultBasin : allowedValues[0];
  }, [countertopColor, countertopRuleState, countertopStyle, isVesselStyle, profile, sinkType]);

  useEffect(() => {
    // Before the collection loads every rule reads as unavailable; nothing is cleared on that account.
    if (!profile || isRestoring || !isSceneReady || !cabinetKeys) return;

    const unavailable = [
      ...(isFlutingAvailable ? [] : ["DrawerPanelFluting"]),
      ...(isGrainAvailable ? [] : ["GrainDirection"]),
    ];

    for (const attributeId of unavailable) {
      const request = resolveChangeRequest(getState(), attributeId, selectInitialValue(profile, attributeId));
      if (!request) continue;

      void change(request).then(warnIfNotReset(attributeId));
    }
  }, [cabinetKeys, change, getState, isFlutingAvailable, isGrainAvailable, isRestoring, isSceneReady, profile]);

  useEffect(() => {
    if (!profile || isRestoring || isBookMatchingEnabled || !bookMatching) return;

    const request = resolveChangeRequest(getState(), "BookMatching", selectInitialValue(profile, "BookMatching"));
    if (!request) return;

    void change(request).then(warnIfNotReset("BookMatching"));
  }, [bookMatching, change, getState, isBookMatchingEnabled, isRestoring, profile]);

  useEffect(() => {
    // The vessel minimum is judged by the Sink Base: with none placed the rules read the builder's sizes instead.
    if (!profile || isRestoring || !isSceneReady || !isSinkBasePlaced || isSinkHosted || !nextStyle) return;

    const request = resolveChangeRequest(getState(), "CountertopStyle", nextStyle);
    if (!request) return;

    isBasinOwedRef.current = true;
    void change(request).then((result) => {
      if (result.status !== "applied") isBasinOwedRef.current = false;
      warnIfNotReset("CountertopStyle")(result);
    });
  }, [change, getState, isRestoring, isSceneReady, isSinkBasePlaced, isSinkHosted, nextStyle, profile]);

  useEffect(() => {
    if (!isBasinOwedRef.current) return;
    if (isRestoring) {
      isBasinOwedRef.current = false;
      return;
    }
    // The basin is judged for the style the reset chose, once it is recorded.
    if (isVesselStyle) return;

    isBasinOwedRef.current = false;
    if (!nextBasin) return;

    const request = resolveChangeRequest(getState(), "sinkType", nextBasin);
    if (!request) return;

    void change(request).then(warnIfNotReset("sinkType"));
  }, [change, getState, isRestoring, isVesselStyle, nextBasin]);
};
