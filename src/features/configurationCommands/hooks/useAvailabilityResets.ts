import { useEffect } from "react";

import { selectInitialValue } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration";
import { selectFlutingState, selectGrainDirectionState } from "@/entities/product/model/store/derivedSelectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

/**
 * Clears fluting and grain direction in the scene while the rules make them unavailable.
 *
 * The option listeners clear the stored value the moment the material changes. The scene
 * is cleared here, through the command service, so the runtime bindings decide what a
 * cleared value is for the scene ("None" for fluting) and one place sends it. It runs
 * again when the cabinets change, so a cabinet added meanwhile is cleared too.
 * Mounted once, for both flows.
 */
export const useAvailabilityResets = ({ runtime }: UseChangeAttributeOptions = {}) => {
  const { change, getState } = useChangeAttribute({ runtime });
  const isSceneReady = usePlayCanvasReady();
  const profile = useAppSelector(getActiveProductProfile);
  const isFlutingAvailable = useAppSelector(selectFlutingState).available;
  const isGrainAvailable = useAppSelector(selectGrainDirectionState).available;
  const cabinetKeys = useAppSelector((state) =>
    getCabinetEntries(state)
      .map(({ runtimeId }) => runtimeId)
      .join("|"),
  );

  useEffect(() => {
    // Before the collection loads every rule reads as unavailable; nothing is cleared on that account.
    if (!profile || !isSceneReady || !cabinetKeys) return;

    const unavailable = [
      ...(isFlutingAvailable ? [] : ["DrawerPanelFluting"]),
      ...(isGrainAvailable ? [] : ["GrainDirection"]),
    ];

    for (const attributeId of unavailable) {
      const request = resolveChangeRequest(getState(), attributeId, selectInitialValue(profile, attributeId));
      if (!request) continue;

      void change(request).then((result) => {
        if (result.status !== "applied") {
          console.warn(`[useAvailabilityResets] ${attributeId} was not cleared in the scene`, result);
        }
      });
    }
  }, [cabinetKeys, change, getState, isFlutingAvailable, isGrainAvailable, isSceneReady, profile]);
};
