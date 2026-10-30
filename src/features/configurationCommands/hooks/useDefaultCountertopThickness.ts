import { useEffect } from "react";

import { getActiveProductProfile, getDimensionsByCabinet } from "@/entities/configuration";
import { getIsRestoreOrUndoRunning } from "@/entities/history/model/store/selectors";
import { getActiveCountertopThickness, getCountertopStyle } from "@/entities/product/model/store/selectors";
import {
  resolveDefaultThicknessFromRules,
  type CountertopMatrixRule,
} from "@/features/configurator-rule-core/countertop";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { useChangeAttribute, type UseChangeAttributeOptions } from "./useChangeAttribute";

type DefaultCountertopThicknessContext = {
  rules: CountertopMatrixRule[];
  activeMaterialTokens: string[];
  width: number | null;
  depth: number | null;
};

/**
 * Sets the thickness the countertop rules give first for the material while none is set, so the
 * scene and its dimension tool read a real thickness before the user reaches the countertop step.
 * The player passes what only it reads: the rules, the material of the chosen colour and the Sink
 * Base width from the scene.
 *
 * The value is the rules', not the user's, so it takes no history step. A restore or an undo sets
 * the thickness itself, together with the countertop it was saved with, so nothing is set until it
 * ends, as `useAvailabilityResets` waits.
 *
 * A collection whose countertop matrix is judged by the actual module sizes (Tricot) refuses the
 * thickness until the scene has reported them, so the default is tried again once it has.
 */
export const useDefaultCountertopThickness = (
  { rules, activeMaterialTokens, width, depth }: DefaultCountertopThicknessContext,
  { runtime }: UseChangeAttributeOptions = {},
) => {
  const { change } = useChangeAttribute({ runtime });
  const profile = useAppSelector(getActiveProductProfile);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const thickness = useAppSelector(getActiveCountertopThickness);
  const isRestoring = useAppSelector(getIsRestoreOrUndoRunning);
  const cabinetSizes = useAppSelector(getDimensionsByCabinet);

  useEffect(() => {
    if (thickness || isRestoring || !activeMaterialTokens.length || !rules.length) return;

    const defaultThickness = resolveDefaultThicknessFromRules({
      profile,
      rules,
      activeMaterialTokens,
      width,
      depth,
      activeCountertopStyle: countertopStyle,
    });
    if (defaultThickness) void change({ attributeId: "Thickness", value: defaultThickness, scope: "countertop" });
  }, [
    activeMaterialTokens,
    cabinetSizes,
    change,
    countertopStyle,
    depth,
    isRestoring,
    profile,
    rules,
    thickness,
    width,
  ]);
};
