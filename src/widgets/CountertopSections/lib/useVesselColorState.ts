import { useCallback, useEffect, useMemo, useState } from "react";

import { getVesselColor } from "@/entities/product/model/store/selectors";
import {
  isMaterialCompatibleWithVesselStyle,
  normalizeMaterialToken,
} from "@/features/configurator-rule-core/countertop";
import {
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { useAppSelector } from "@/shared/hooks/store/redux";

import {
  buildVesselMaterialFilters,
  getOptionConfigValue,
  getVesselOptionColorCode,
  getVesselOptionMaterialTokens,
  isVesselColorOption,
  vesselMaterialsMatchSelection,
  type MaterialFilterOption,
} from "./countertopColorOptions";

import type { CountertopContext } from "./useCountertopContext";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import type { MaterialFilters } from "./countertopColorOptions";

type VesselColorStateArgs = {
  context: CountertopContext;
  vesselColorOptions: ProductOptionData[];
  defaultMaterialFilters: MaterialFilters;
};

/** Vessel colours judged by the chosen vessel style, their filters, and the colour the scene shows. */
export const useVesselColorState = ({ context, vesselColorOptions, defaultMaterialFilters }: VesselColorStateArgs) => {
  const { activeProfile, activeBasinStyle, messages } = context;
  const storedVesselColor = useAppSelector(getVesselColor);
  const [activeVesselColor, setActiveVesselColor] = useState(storedVesselColor);
  const [selection, setSelection] = useState<MaterialFilterSelection>({});

  useEffect(() => {
    setActiveVesselColor(storedVesselColor);
  }, [storedVesselColor]);

  const isCompatibleWithSinkStyle = useCallback(
    (option: ProductOptionData) =>
      isMaterialCompatibleWithVesselStyle({
        vesselStyle: activeBasinStyle,
        materialTokens: getVesselOptionMaterialTokens(option),
        colorCode: getVesselOptionColorCode(option),
        profile: activeProfile,
      }),
    [activeBasinStyle, activeProfile],
  );

  const filters = useMemo(() => {
    const base = buildVesselMaterialFilters(vesselColorOptions, defaultMaterialFilters);
    const hasCompatibleColor = (materialValue: string) =>
      vesselColorOptions.some(
        (option) =>
          isVesselColorOption(option) &&
          vesselMaterialsMatchSelection(option, materialValue) &&
          isCompatibleWithSinkStyle(option),
      );
    const annotate = (option: MaterialFilterOption): MaterialFilterOption => {
      if (option.children?.length) {
        const parentToken = normalizeMaterialToken(option.value);
        const children = option.children
          .filter((child) => normalizeMaterialToken(child.value) !== parentToken)
          .map(annotate);
        const disabled = children.length > 0 && children.every((child) => child.disabled);
        return { ...option, children, disabled, reason: disabled ? messages.vesselColorUnavailable : undefined };
      }
      const disabled = !hasCompatibleColor(option.value);
      return { ...option, disabled, reason: disabled ? messages.vesselColorUnavailable : undefined };
    };

    return { ...base, materials: groupMaterialsHierarchically(base.materials).map(annotate) };
  }, [defaultMaterialFilters, isCompatibleWithSinkStyle, messages.vesselColorUnavailable, vesselColorOptions]);

  const tierOptions = useMemo(() => buildTierFilterOptions(vesselColorOptions), [vesselColorOptions]);

  const visibleOptions = useMemo(() => {
    const findInTree = (options: MaterialFilterOption[], target: string): MaterialFilterOption | null => {
      for (const option of options) {
        if (option.value === target) return option;
        const found = option.children?.length ? findInTree(option.children, target) : null;
        if (found) return found;
      }
      return null;
    };
    const selectedNode = selection.material ? findInTree(filters.materials, selection.material) : null;
    const selectedMaterials = selectedNode?.children?.length
      ? [selectedNode.value, ...selectedNode.children.map((child) => child.value)]
      : selection.material
        ? [selection.material]
        : [];
    const isTekorlux = normalizeMaterialToken(selection.material ?? "") === "tekorlux";

    const byFilters = filterOptionsByMaterialSelection(vesselColorOptions.filter(isVesselColorOption), {
      ...selection,
      material: undefined,
    });
    const byMaterial =
      selectedMaterials.length === 0
        ? byFilters
        : byFilters.filter((option) =>
            (isTekorlux ? [selection.material ?? ""] : selectedMaterials).some((material) =>
              vesselMaterialsMatchSelection(option, material),
            ),
          );

    return filterOptionsByTier(byMaterial, selection.tier)
      .map((option) => {
        const isAvailable = isCompatibleWithSinkStyle(option);
        return { ...option, isAvailable, disabledReason: isAvailable ? undefined : messages.vesselColorUnavailable };
      })
      .sort((a, b) => {
        const availabilityDiff = Number(a.isAvailable === false) - Number(b.isAvailable === false);
        return availabilityDiff !== 0 ? availabilityDiff : (a.title ?? "").localeCompare(b.title ?? "");
      });
  }, [filters.materials, isCompatibleWithSinkStyle, messages.vesselColorUnavailable, selection, vesselColorOptions]);

  const findOptionByValue = useCallback(
    (colorName: string) =>
      vesselColorOptions.find((option) => getOptionConfigValue(option) === colorName || option.title === colorName),
    [vesselColorOptions],
  );

  return {
    activeVesselColor,
    setActiveVesselColor,
    filters,
    tierOptions,
    visibleOptions,
    selection,
    setSelection,
    findOptionByValue,
    isCompatibleWithSinkStyle,
  };
};
