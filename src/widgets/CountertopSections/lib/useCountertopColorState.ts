import { useCallback, useMemo, useState } from "react";

import { sortCountertopOptionsByAvailability } from "@/entities/countertop";
import { dedupeProductOptionsByValue } from "@/entities/product/lib/dedupeProductOptionsByValue";
import { normalizeMaterialToken } from "@/features/configurator-rule-core/countertop";
import {
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  materialFilterValuesMatch,
  resolveSelectedMaterialFilterValues,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";

import {
  buildCountertopColorOptions,
  buildCountertopMaterialFilters,
  buildDefaultMaterialFilters,
  getOptionConfigValue,
  isVesselApiOption,
  isVesselColorOption,
  type MaterialFilterOption,
} from "./countertopColorOptions";
import {
  annotateMaterialFilters,
  evaluateMaterialOption,
  materialFilterReason,
  reasonForFailure,
  type MaterialRuleInputs,
} from "./materialCompatibility";

import type { CountertopContext } from "./useCountertopContext";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

/** Countertop colours with their availability by the matrix, and the filters over them. */
export const useCountertopColorState = (context: CountertopContext) => {
  const {
    activeProfile,
    activeBasinStyle,
    activeCountertopStyle,
    cabinetCompositionCount,
    configuratorGroups,
    countertopRules,
    excludedMaterialFilterTokens,
    messages,
    sceneTotalWidth,
    selectedDimensions,
    sinkBaseDims,
    syntesiMaterial,
  } = context;
  const [selection, setSelection] = useState<MaterialFilterSelection>({});

  const ruleInputs = useMemo<MaterialRuleInputs>(
    () => ({
      activeBasinStyle,
      activeCountertopStyle,
      activeProfile,
      cabinetCompositionCount,
      countertopRules,
      depth: sinkBaseDims.depth ?? selectedDimensions.depth ?? null,
      sinkBaseWidth: sinkBaseDims.width,
      totalWidth: sceneTotalWidth,
    }),
    [
      activeBasinStyle,
      activeCountertopStyle,
      activeProfile,
      cabinetCompositionCount,
      countertopRules,
      sceneTotalWidth,
      selectedDimensions.depth,
      sinkBaseDims.depth,
      sinkBaseDims.width,
    ],
  );

  const defaultMaterialFilters = useMemo(
    () => buildDefaultMaterialFilters(excludedMaterialFilterTokens),
    [excludedMaterialFilterTokens],
  );

  const allColorOptions = useMemo(
    () => buildCountertopColorOptions(configuratorGroups, countertopRules, activeProfile),
    [activeProfile, configuratorGroups, countertopRules],
  );
  const countertopOptions = useMemo(
    () => allColorOptions.filter((option) => !isVesselApiOption(option)),
    [allColorOptions],
  );
  const vesselColorOptions = useMemo(
    () =>
      dedupeProductOptionsByValue(allColorOptions.filter(isVesselColorOption), (option) =>
        isVesselApiOption(option) ? 1 : 0,
      ),
    [allColorOptions],
  );

  const materialFilters = useMemo(
    () =>
      buildCountertopMaterialFilters({
        groups: configuratorGroups,
        countertopOptions,
        defaultFilters: defaultMaterialFilters,
        excludedTokens: excludedMaterialFilterTokens,
        matrixMaterials: new Set(
          countertopRules.map(({ material }) => normalizeMaterialToken(material.trim())).filter(Boolean),
        ),
        syntesiMaterial,
      }),
    [
      configuratorGroups,
      countertopOptions,
      countertopRules,
      defaultMaterialFilters,
      excludedMaterialFilterTokens,
      syntesiMaterial,
    ],
  );
  const groupedMaterials = useMemo(
    () => groupMaterialsHierarchically(materialFilters.materials) as MaterialFilterOption[],
    [materialFilters.materials],
  );
  const tierOptions = useMemo(() => buildTierFilterOptions(countertopOptions), [countertopOptions]);

  const withMaterialAvailability = useCallback(
    (option: ProductOptionData) => {
      const { isCompatible, failedBy } = evaluateMaterialOption(option, ruleInputs);
      return {
        ...option,
        isAvailable: isCompatible,
        disabledReason: isCompatible ? undefined : reasonForFailure(failedBy, messages),
      };
    },
    [messages, ruleInputs],
  );

  const filters = useMemo(() => {
    const reasonOf = (materialValue: string) => {
      const evaluations = countertopOptions
        .filter((option) =>
          (option.metadata?.materials ?? []).some((material) => materialFilterValuesMatch(material, materialValue)),
        )
        .map((option) => evaluateMaterialOption(option, ruleInputs));
      return materialFilterReason(materialValue, evaluations, ruleInputs, messages);
    };

    return {
      materials: annotateMaterialFilters(groupedMaterials, reasonOf, messages),
      colors: materialFilters.colors,
      looks: materialFilters.looks,
    };
  }, [countertopOptions, groupedMaterials, materialFilters.colors, materialFilters.looks, messages, ruleInputs]);

  const visibleOptions = useMemo(() => {
    const selectedMaterials = resolveSelectedMaterialFilterValues(groupedMaterials, selection.material);
    const byFilters = filterOptionsByMaterialSelection(countertopOptions, { ...selection, material: undefined });
    const byMaterial =
      selectedMaterials.length === 0
        ? byFilters
        : byFilters.filter((option) =>
            selectedMaterials.some((selected) =>
              (option.metadata?.materials ?? []).some((material) => materialFilterValuesMatch(material, selected)),
            ),
          );

    return sortCountertopOptionsByAvailability(
      filterOptionsByTier(byMaterial, selection.tier).map(withMaterialAvailability),
    );
  }, [countertopOptions, groupedMaterials, selection, withMaterialAvailability]);

  const fullModeOptions = useMemo(
    () => sortCountertopOptionsByAvailability(countertopOptions.map(withMaterialAvailability)),
    [countertopOptions, withMaterialAvailability],
  );

  const isColorCompatible = useCallback(
    (colorName: string) => {
      const option = countertopOptions.find(
        (item) => getOptionConfigValue(item) === colorName || item.title === colorName,
      );
      return !option || evaluateMaterialOption(option, ruleInputs).isCompatible;
    },
    [countertopOptions, ruleInputs],
  );

  return {
    vesselColorOptions,
    defaultMaterialFilters,
    filters,
    fullModeMaterials: groupedMaterials,
    tierOptions,
    visibleOptions,
    fullModeOptions,
    selection,
    setSelection,
    isColorCompatible,
  };
};
