import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopColorSku,
  getCountertopStyle,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProducts,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import {
  buildCountertopRuleState,
  useCountertopRules,
  type CountertopMaterialRuleInputs,
} from "@/features/configurator-rule-core/countertop";
import { getActiveProductProfile, useIsSinkBase } from "@/entities/configuration";
import { useSceneTotalWidthWithSidePanels } from "@/features/sidePanel";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";
import {
  buildCountertopColorSkuCandidates,
  getCountertopMaterialTokensFromBasinType,
  resolveCountertopMaterialTokensFromCandidates,
} from "@/shared/lib/sku";

export type CountertopRuleState = ReturnType<typeof buildCountertopRuleState> & {
  activeMaterialTokens: string[];
  /** The sizes, style and composition the rules above were judged for, to judge any other colour by. */
  materialRuleInputs: CountertopMaterialRuleInputs;
};

/** The countertop matrix judged for the current colour, sizes, style, basin and thickness. */
export const useCountertopRuleState = (): CountertopRuleState => {
  const rules = useCountertopRules();
  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
  const activeProfile = useAppSelector(getActiveProductProfile);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const thickness = useAppSelector(getActiveCountertopThickness);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const basinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const presetsProducts = useAppSelector(getProductsPresets);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts, useIsSinkBase());
  const sceneTotalWidth = useSceneTotalWidthWithSidePanels(selectedProducts, null);

  return useMemo(() => {
    const activeMaterialTokens = resolveCountertopMaterialTokensFromCandidates({
      value: countertopColor,
      candidatesByValue: buildCountertopColorSkuCandidates(configuratorGroups),
      preferredSku: countertopColorSku,
      preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(basinStyle),
    });

    const sinkBaseWidth = sinkBaseDims.width ?? selectedDimensions.width;
    const totalWidth = sceneTotalWidth ?? selectedDimensions.width;
    const depth = sinkBaseDims.depth ?? selectedDimensions.depth;

    const ruleState = buildCountertopRuleState({
      rules,
      activeMaterialTokens,
      width: sinkBaseWidth,
      sinkBaseWidth,
      totalWidth,
      depth,
      activeCountertopStyle: countertopStyle,
      activeBasinStyle: basinStyle,
      activeThickness: thickness,
      profile: activeProfile,
    });

    const materialRuleInputs: CountertopMaterialRuleInputs = {
      activeBasinStyle: basinStyle,
      activeCountertopStyle: countertopStyle,
      activeProfile,
      cabinetCompositionCount: selectedProducts.length > 0 ? selectedProducts.length : presetsProducts.length,
      countertopRules: rules,
      depth: depth ?? null,
      sinkBaseWidth,
      totalWidth,
    };

    return { ...ruleState, activeMaterialTokens, materialRuleInputs };
  }, [
    activeProfile,
    basinStyle,
    configuratorGroups,
    countertopColor,
    countertopColorSku,
    countertopStyle,
    presetsProducts.length,
    rules,
    sceneTotalWidth,
    selectedDimensions.depth,
    selectedDimensions.width,
    selectedProducts.length,
    sinkBaseDims.depth,
    sinkBaseDims.width,
    thickness,
  ]);
};
