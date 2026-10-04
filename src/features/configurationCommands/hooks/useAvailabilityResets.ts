import { useEffect } from "react";

import { selectInitialValue } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries, getRestoreState } from "@/entities/configuration";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import { getBookMatching } from "@/entities/product/model/store/selectors";
import {
  selectBookMatchingState,
  selectFlutingState,
  selectGrainDirectionState,
} from "@/entities/product/model/store/derivedSelectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import type { ChangeResult } from "../model/types";
import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

const warnIfNotCleared = (attributeId: string) => (result: ChangeResult) => {
  if (result.status !== "applied") {
    console.warn(`[useAvailabilityResets] ${attributeId} was not cleared`, result);
  }
};

/**
 * Clears fluting, grain direction and book matching while the rules make them unavailable.
 *
 * This is the one owner of these resets: the command records the cleared value and, for fluting
 * and grain, the runtime bindings decide what a cleared value is for the scene ("None" for
 * fluting). Fluting and grain run again when the cabinets change, so a cabinet added meanwhile
 * is cleared too; with no cabinet placed there is nothing to address yet. Book matching is never
 * shown by the scene, so it is cleared without waiting for it. A restore or undo sets these
 * values in several steps, so nothing is cleared until it finishes. Mounted once, for both flows.
 */
export const useAvailabilityResets = ({ runtime }: UseChangeAttributeOptions = {}) => {
  const { change, getState } = useChangeAttribute({ runtime });
  const isSceneReady = usePlayCanvasReady();
  const profile = useAppSelector(getActiveProductProfile);
  const isRestoring = useAppSelector(
    (state) => getRestoreState(state).status === "restoring" || getIsHistoryRestoring(state),
  );
  const isFlutingAvailable = useAppSelector(selectFlutingState).available;
  const isGrainAvailable = useAppSelector(selectGrainDirectionState).available;
  const isBookMatchingEnabled = useAppSelector(selectBookMatchingState).enabled;
  const bookMatching = useAppSelector(getBookMatching);
  const cabinetKeys = useAppSelector((state) =>
    getCabinetEntries(state)
      .map(({ runtimeId }) => runtimeId)
      .join("|"),
  );

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

      void change(request).then(warnIfNotCleared(attributeId));
    }
  }, [cabinetKeys, change, getState, isFlutingAvailable, isGrainAvailable, isRestoring, isSceneReady, profile]);

  useEffect(() => {
    if (!profile || isRestoring || isBookMatchingEnabled || !bookMatching) return;

    const request = resolveChangeRequest(getState(), "BookMatching", selectInitialValue(profile, "BookMatching"));
    if (!request) return;

    void change(request).then(warnIfNotCleared("BookMatching"));
  }, [bookMatching, change, getState, isBookMatchingEnabled, isRestoring, profile]);
};
