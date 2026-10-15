import { useEffect } from "react";

import { getRestoreState } from "@/entities/configuration";
import { getIsHistoryRestoring } from "@/entities/history/model/store/selectors";
import { setActiveBasinStyle } from "@/entities/product/model/store/slice";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getCountertopMaterialTokensFromBasinType, resolveDefaultBasinForCountertopSelection } from "@/shared/lib/sku";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import type { CountertopContext } from "./useCountertopContext";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

type CountertopResetsArgs = {
  context: CountertopContext;
  allowedThicknessValues: ReadonlySet<string>;
  availableBasinOptions: ProductOptionData[];
  hasSinkBase: boolean;
  isActiveStyleAvailable: boolean;
  /** Sets the thickness the rules allow; the reset is the rules', not the user's, so it takes no undo step. */
  resetThickness: (thickness: string) => Promise<unknown>;
  applyBasin: (basinStyle: string) => Promise<void>;
};

/**
 * Three resets that pick a value the rules allow; they move to C's reset owner once a basin command exists.
 * A restore or an undo sets these values in several steps, so nothing is reset until it ends, as
 * `useAvailabilityResets` waits; the effects run again once it has.
 */
export const useCountertopResets = ({
  context,
  allowedThicknessValues,
  availableBasinOptions,
  hasSinkBase,
  isActiveStyleAvailable,
  resetThickness,
  applyBasin,
}: CountertopResetsArgs) => {
  const dispatch = useAppDispatch();
  const { activeBasinStyle, activeCountertopColor, activeMaterialTokens, activeThickness, isVesselStyle, ruleState } =
    context;
  const isRestoring = useAppSelector(
    (state) => getRestoreState(state).status === "restoring" || getIsHistoryRestoring(state),
  );

  // Thickness: the first allowed one when the current is not.
  useEffect(() => {
    if (isRestoring) return;
    if (!allowedThicknessValues.size || (activeThickness && allowedThicknessValues.has(activeThickness))) return;
    void resetThickness([...allowedThicknessValues][0]);
  }, [activeThickness, allowedThicknessValues, isRestoring, resetThickness]);

  // Integrated basin: the default of the material, or the first offered one when the current is not offered.
  useEffect(() => {
    if (isRestoring) return;
    if (!activeCountertopColor || !activeThickness || !hasSinkBase || isVesselStyle) return;
    if (!isActiveStyleAvailable || !availableBasinOptions.length) return;

    const isOffered = (value: string | null) =>
      value !== null && availableBasinOptions.some((option) => (option.name ?? option.title) === value);
    const currentStillValid = isOffered(activeBasinStyle);
    const defaultBasin = resolveDefaultBasinForCountertopSelection({
      countertopColor: activeCountertopColor,
      materialTokens: activeMaterialTokens,
    });
    const currentFamily = new Set(getCountertopMaterialTokensFromBasinType(activeBasinStyle));
    const defaultFamily = getCountertopMaterialTokensFromBasinType(defaultBasin);
    const sameFamily = defaultFamily.length > 0 && defaultFamily.some((token) => currentFamily.has(token));

    if (
      defaultBasin &&
      isOffered(defaultBasin) &&
      (activeBasinStyle === "Top_HPLPrisma" || !currentStillValid || !sameFamily)
    ) {
      void applyBasin(defaultBasin);
    } else if (!currentStillValid) {
      const first = availableBasinOptions[0];
      const value = first?.name ?? first?.title;
      if (value) void applyBasin(value);
    }
  }, [
    activeBasinStyle,
    activeCountertopColor,
    activeMaterialTokens,
    activeThickness,
    applyBasin,
    availableBasinOptions,
    hasSinkBase,
    isActiveStyleAvailable,
    isRestoring,
    isVesselStyle,
  ]);

  // Vessel: back to the empty cutout when the rules stop allowing a vessel.
  useEffect(() => {
    if (isRestoring) return;
    if (!isVesselStyle || ruleState.vesselSinkAvailability.isAvailable) return;
    if (!activeBasinStyle.startsWith("Vessel_")) return;
    void setConfigBatch({ productType: "Sink-Base" }, { sinkType: "Vessel" });
    dispatch(setActiveBasinStyle(""));
  }, [activeBasinStyle, dispatch, isRestoring, isVesselStyle, ruleState.vesselSinkAvailability.isAvailable]);
};
