import { useMemo } from "react";

import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  getActiveCountertopThickness,
  getCountertopColorSku,
  getCountertopStyle,
  getSelectedDimensions,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { getCountertopMaterialTokensBySku } from "@/shared/lib/sku";

import { resolveCountertopMaxLengthByRules } from "../lengthLimits";

import { useCountertopRules } from "./useCountertopRules";

/**
 * Resolves the maximum countertop length (cm) for the current product state
 * by calling the rule engine with the standard 6 inputs (rules + 5 selectors).
 * Returns null when no rule applies (e.g. plain style or empty matrix).
 */
export const useMaxCountertopLength = (): number | null => {
  const rules = useCountertopRules();
  const sku = useAppSelector(getCountertopColorSku);
  const style = useAppSelector(getCountertopStyle);
  const thickness = useAppSelector(getActiveCountertopThickness);
  const basinStyle = useAppSelector(getSinkType);
  const dimensions = useAppSelector(getSelectedDimensions);

  return useMemo(
    () => {
      const skuMaterialTokens = getCountertopMaterialTokensBySku(sku);
      const materialTokens = skuMaterialTokens.length > 0 ? skuMaterialTokens : sku ? [sku] : [];

      return resolveCountertopMaxLengthByRules({
        rules,
        materialTokens,
        style: style ?? null,
        depth: dimensions.depth ?? null,
        thickness: thickness ?? null,
        activeBasinStyle: basinStyle ?? null,
      });
    },
    [rules, sku, style, dimensions.depth, thickness, basinStyle],
  );
};
