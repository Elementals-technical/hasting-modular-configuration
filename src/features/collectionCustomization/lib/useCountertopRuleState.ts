import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopColorSku,
  getCountertopStyle,
  getSelectedDimensions,
  getSelectedProducts,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { buildCountertopRuleState, useCountertopRules } from "@/features/configurator-rule-core/countertop";
import { getActiveProductProfile } from "@/entities/configuration";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";
import {
  buildCountertopColorSkuCandidates,
  getCountertopMaterialTokensFromBasinType,
  resolveCountertopMaterialTokensFromCandidates,
} from "@/shared/lib/sku";

export type CountertopRuleState = ReturnType<typeof buildCountertopRuleState>;

/** The countertop matrix judged for the current colour, size, style, basin and thickness. */
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
  const sinkBaseDims = useSinkBaseDimensions(useAppSelector(getSelectedProducts));

  return useMemo(() => {
    const activeMaterialTokens = resolveCountertopMaterialTokensFromCandidates({
      value: countertopColor,
      candidatesByValue: buildCountertopColorSkuCandidates(configuratorGroups),
      preferredSku: countertopColorSku,
      preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(basinStyle),
    });

    return buildCountertopRuleState({
      rules,
      activeMaterialTokens,
      width: sinkBaseDims.width ?? selectedDimensions.width,
      depth: sinkBaseDims.depth ?? selectedDimensions.depth,
      activeCountertopStyle: countertopStyle,
      activeBasinStyle: basinStyle,
      activeThickness: thickness,
      profile: activeProfile,
    });
  }, [
    activeProfile,
    basinStyle,
    configuratorGroups,
    countertopColor,
    countertopColorSku,
    countertopStyle,
    rules,
    selectedDimensions.depth,
    selectedDimensions.width,
    sinkBaseDims.depth,
    sinkBaseDims.width,
    thickness,
  ]);
};
