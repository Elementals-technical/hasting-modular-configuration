import { useEffect } from "react";

import type { CustomizationFieldDefinition, FieldRuntimeState } from "@/entities/collection";
import { getRestoreState } from "@/entities/configuration";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { resolveChangeRequest } from "../lib/resolveChangeRequest";
import { useChangeAttribute } from "./useChangeAttribute";

/**
 * Keeps a field that declares `autoSelect: "firstAllowed"` on a value its rules allow, as the Urban
 * Standard Height countertop step keeps its thickness, basin and vessel colour: while the value shown
 * is none of the enabled options, the command sets the one the rules prefer, else the first enabled
 * one. With no option enabled nothing changes.
 *
 * The change is the field's own, not the user's, so it takes no history step. As the availability
 * resets, it waits for the scene and for a restore or undo to finish.
 */
export const useFieldAutoSelect = (
  field: FieldRuntimeState,
  autoSelect: CustomizationFieldDefinition["autoSelect"],
) => {
  const { change, getState } = useChangeAttribute();
  const isSceneReady = usePlayCanvasReady();
  const isRestoring = useAppSelector(
    (state) => getRestoreState(state).status === "restoring" || getIsHistoryRestoring(state),
  );

  const enabledValues = field.options.filter(({ enabled }) => enabled).map(({ value }) => value);
  const isAllowed = enabledValues.some((value) => value === field.value);
  const next =
    autoSelect === "firstAllowed" && field.visible && field.enabled && !isAllowed
      ? (enabledValues.find((value) => value === field.preferredValue) ?? enabledValues[0])
      : undefined;
  const { attributeId } = field;

  useEffect(() => {
    if (next === undefined || isRestoring || !isSceneReady) return;

    const request = resolveChangeRequest(getState(), attributeId, next);
    if (request) void change(request);
  }, [attributeId, change, getState, isRestoring, isSceneReady, next]);
};
