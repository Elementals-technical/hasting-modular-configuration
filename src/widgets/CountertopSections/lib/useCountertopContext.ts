import { useMemo } from "react";

import { selectMessage, selectMessageOr, useActiveCollection } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration/model/store/selectors";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopStyle,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProducts,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { useCountertopRuleState } from "@/features/collectionCustomization";
import {
  isIntegratedCountertopDepthRestrictedByMaterial,
  REASON_SYNTESI_SINGLE_CABINET,
  REASON_VESSEL_COLOR_UNAVAILABLE,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";
import { useSceneTotalWidthWithSidePanels } from "@/features/sidePanel";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";

const NO_EXCLUDED_MATERIAL_FILTERS: readonly string[] = [];

/** Reason codes as `REASON_…` constants (the DEV-08 test reads them); the English text is the fallback. */
const REASON_MATERIAL_SIZE = "countertop.materialNotAvailableForSize";
const REASON_MATERIAL_TOTAL_WIDTH = "countertop.materialNotAvailableForTotalWidth";
const REASON_MATERIAL_DEPTH = "countertop.materialNotAvailableForDepth";
const REASON_MATERIAL_WIDTH = "countertop.materialNotAvailableForWidth";
const REASON_MATERIAL_SELECTION = "countertop.materialNotAvailableForSelection";
const FALLBACK_MATERIAL_SIZE = "Not available for current cabinet size on scene";
const FALLBACK_MATERIAL_TOTAL_WIDTH = "Not available for current total cabinets width on scene";
const FALLBACK_MATERIAL_DEPTH = "Not available for current cabinet depth";
const FALLBACK_MATERIAL_WIDTH = "Not available for current cabinet width";
const FALLBACK_MATERIAL_SELECTION = "Not available for selected cabinet width/depth/thickness on scene";

/** Everything the countertop sections read from the store, the collection and the rules. */
export const useCountertopContext = () => {
  const activeProfile = useAppSelector(getActiveProductProfile);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const presetsProducts = useAppSelector(getProductsPresets);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetEntries = useAppSelector(getCabinetEntries);
  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const countertopRules = useCountertopRules();
  const sceneTotalWidth = useSceneTotalWidthWithSidePanels(selectedProducts, null);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts);
  const { activeMaterialTokens, ...ruleState } = useCountertopRuleState();

  const isDepth46VesselOnly = useMemo(
    () =>
      isIntegratedCountertopDepthRestrictedByMaterial({
        activeMaterialTokens,
        depth: sinkBaseDims.depth ?? selectedDimensions.depth ?? null,
        profile: activeProfile,
      }),
    [activeMaterialTokens, activeProfile, selectedDimensions.depth, sinkBaseDims.depth],
  );

  const messages = useMemo(
    () => ({
      size: selectMessageOr(activeProfile, REASON_MATERIAL_SIZE, FALLBACK_MATERIAL_SIZE),
      totalWidth: selectMessageOr(activeProfile, REASON_MATERIAL_TOTAL_WIDTH, FALLBACK_MATERIAL_TOTAL_WIDTH),
      depth: selectMessageOr(activeProfile, REASON_MATERIAL_DEPTH, FALLBACK_MATERIAL_DEPTH),
      width: selectMessageOr(activeProfile, REASON_MATERIAL_WIDTH, FALLBACK_MATERIAL_WIDTH),
      selection: selectMessageOr(activeProfile, REASON_MATERIAL_SELECTION, FALLBACK_MATERIAL_SELECTION),
      vesselColorUnavailable: selectMessage(activeProfile, REASON_VESSEL_COLOR_UNAVAILABLE),
      syntesiSingleCabinet: selectMessage(activeProfile, REASON_SYNTESI_SINGLE_CABINET),
    }),
    [activeProfile],
  );

  return {
    activeProfile,
    selectedProducts,
    presetNames: useMemo(() => presetsProducts.map((preset) => preset.name), [presetsProducts]),
    cabinetCompositionCount: selectedProducts.length > 0 ? selectedProducts.length : presetsProducts.length,
    activeCountertopColor,
    activeThickness,
    activeCountertopStyle,
    activeBasinStyle,
    isVesselStyle: (activeCountertopStyle ?? "").trim().toLowerCase() === "vessel",
    sinkBaseCabinetId: cabinetEntries.find(({ runtimeId }) => runtimeId.toLowerCase().includes("sink-base"))?.stableKey,
    selectedDimensions,
    sinkBaseDims,
    sceneTotalWidth,
    configuratorGroups,
    countertopRules,
    ruleState,
    activeMaterialTokens,
    isDepth46VesselOnly,
    excludedMaterialFilterTokens:
      activeProfile?.ruleData.countertopFallbacks?.excludedMaterialFilterTokens ?? NO_EXCLUDED_MATERIAL_FILTERS,
    syntesiMaterial: activeProfile?.ruleData.syntesi?.material ?? null,
    messages,
  };
};

export type CountertopContext = ReturnType<typeof useCountertopContext>;
