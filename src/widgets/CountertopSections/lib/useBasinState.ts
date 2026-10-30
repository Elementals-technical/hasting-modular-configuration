import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveCabinetDimensions } from "@/entities/configuration/model/identity";
import { getCabinetEntries, getDimensionsByCabinet } from "@/entities/configuration/model/store/selectors";
import { setActiveBasinStyle } from "@/entities/product/model/store/slice";
import {
  isRuleWidthEligibleForIntegratedContext,
  matchesDepthForStyle,
  materialMatchesRule,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
} from "@/features/configurator-rule-core/countertop";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { normalizeProductConfigSnapshot } from "@/shared/lib/normalizeProductConfigSnapshot";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import { matchesThickness, resolveIntegratedBasinOptions, resolveVesselBasinOptions } from "./basinOptions";
import { VESSEL_SINK_NONE_OPTION_VALUE } from "./countertopColorOptions";

import type { CountertopContext } from "./useCountertopContext";
import type { FieldRuntimeState } from "@/entities/collection";
import type { ProductOptionData } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

const INTEGRATED_DEPTH_46_DISABLED_REASON =
  'Integrated basin style not available for 46cm (18.1") depth configurations';

type BasinStateArgs = {
  context: CountertopContext;
  styleField: FieldRuntimeState | undefined;
  basinField: FieldRuntimeState | undefined;
};

const containsSinkBase = (value: unknown, visited = new Set<unknown>()): boolean => {
  if (!value || visited.has(value)) return false;
  if (typeof value === "string") {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .includes("sinkbase");
  }
  if (typeof value !== "object") return false;

  visited.add(value);
  const entries = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return entries.some((entry) => containsSinkBase(entry, visited));
};

/** Countertop styles and basins judged by the matrix; the basin apply stays here until a basin command. */
export const useBasinState = ({ context, styleField, basinField }: BasinStateArgs) => {
  const {
    activeBasinStyle,
    activeCountertopStyle,
    activeMaterialTokens,
    activeThickness,
    countertopRules,
    isDepth46VesselOnly,
    messages,
    ruleState,
    sceneTotalWidth,
    selectedDimensions,
    selectedProducts,
    sinkBaseDims,
  } = context;
  const dispatch = useAppDispatch();
  const cabinetEntries = useAppSelector(getCabinetEntries);
  const dimensionsByCabinet = useAppSelector(getDimensionsByCabinet);
  const [hasSinkBase, setHasSinkBase] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const orderedIds = getOrderedProductIds(selectedProducts);
      const configs = orderedIds.length ? await Promise.all(orderedIds.map((id) => getConfig(id))) : [];
      if (isMounted) setHasSinkBase(configs.some((config) => (config ? containsSinkBase(config) : false)));
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [selectedProducts]);

  const styleOptions = useMemo(
    () =>
      (styleField?.options ?? []).map((option) => {
        const style = option.value.trim().toLowerCase();
        const availability =
          style === "integrated" || style === "vessel" || style === "undermount"
            ? ruleState.styleAvailability[style]
            : null;
        const blockedByRules = availability ? !availability.isAvailable : false;
        const blockedByDepth = isDepth46VesselOnly && style === "integrated" && availability?.isAvailable !== true;

        return {
          ...option,
          image: option.image,
          enabled: !(blockedByDepth || blockedByRules),
          reason: blockedByDepth
            ? INTEGRATED_DEPTH_46_DISABLED_REASON
            : blockedByRules
              ? availability?.disabledReason
              : undefined,
        };
      }),
    [isDepth46VesselOnly, ruleState.styleAvailability, styleField],
  );

  const activeStyleValue = (activeCountertopStyle ?? "").trim().toLowerCase();
  const isActiveStyleAvailable = styleOptions.some(
    (option) => option.enabled && option.value.trim().toLowerCase() === activeStyleValue,
  );
  const basinSelectionStyle = isActiveStyleAvailable
    ? activeStyleValue
    : (styleOptions
        .find((option) => option.enabled)
        ?.value.trim()
        .toLowerCase() ?? "");
  const isBasinSelectionVesselStyle = basinSelectionStyle === "vessel";

  const basinCatalog = useMemo<ProductOptionData[]>(
    () =>
      (basinField?.options ?? []).map((option) => ({
        id: option.value,
        title: option.label ?? option.value,
        name: option.value,
        isShortDesc: false,
        metadata: { image: option.image, value: option.value },
      })),
    [basinField],
  );

  const basinOptions = useMemo<ProductOptionData[]>(() => {
    if (!basinCatalog.length) return [];
    if (isBasinSelectionVesselStyle) return resolveVesselBasinOptions(basinCatalog, context);

    return resolveIntegratedBasinOptions({
      catalog: basinCatalog,
      integratedNames: new Set(
        (basinField?.options ?? []).filter((option) => option.desc === "integrated").map((option) => option.value),
      ),
      matchingRules: ruleState.matchingRules,
      allowedMaterials: ruleState.allowedMaterials,
      activeMaterials: activeMaterialTokens.map((material) => normalizeMaterialToken(material)),
      activeThickness: activeThickness ? parseThicknessValue(activeThickness) : null,
      widthContext: {
        sinkBaseWidth: sinkBaseDims.width ?? selectedDimensions.width ?? null,
        totalWidth: sceneTotalWidth ?? selectedDimensions.width ?? null,
      },
      fallbackReason: messages.selection,
    });
  }, [
    activeMaterialTokens,
    activeThickness,
    basinCatalog,
    basinField,
    context,
    isBasinSelectionVesselStyle,
    messages.selection,
    ruleState.allowedMaterials,
    ruleState.matchingRules,
    sceneTotalWidth,
    selectedDimensions.width,
    sinkBaseDims.width,
  ]);

  const availableBasinOptions = useMemo(
    () => basinOptions.filter((option) => option.isAvailable !== false),
    [basinOptions],
  );

  // Puts an integrated basin on every sink base whose width the basin rules allow.
  const applyIntegratedBasin = useCallback(
    async (basinStyle: string) => {
      const activeMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));
      const thickness = activeThickness ? parseThicknessValue(activeThickness) : null;
      const basinOption = basinCatalog.find((option) => (option.name ?? option.title) === basinStyle);
      const basinKey = normalizeBasinKey(basinOption?.title ?? basinOption?.name ?? basinStyle);
      const basinRules = countertopRules.filter(
        (rule) =>
          matchesDepthForStyle(rule, selectedDimensions.depth ?? null, "integrated") &&
          matchesThickness(rule.topThicknesses, thickness) &&
          (!activeMaterials.length ||
            activeMaterials.some((material) => materialMatchesRule(material, rule.material))) &&
          normalizeBasinKey(rule.basinStyle) === basinKey,
      );

      const orderedIds = getOrderedProductIds(selectedProducts);
      if (!orderedIds.length) return;

      const configs = await Promise.all(orderedIds.map((id) => getConfig(id)));
      const targetIds = orderedIds.filter((productId, index) => {
        const raw = configs[index];
        if (!raw || typeof raw !== "object" || !containsSinkBase(raw)) return false;
        const { Width } = normalizeProductConfigSnapshot({
          id: productId,
          raw: raw as Record<string, unknown>,
          recordedDimensions: resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, productId),
        });
        return (
          Width !== null &&
          basinRules.some((rule) =>
            isRuleWidthEligibleForIntegratedContext(rule, {
              sinkBaseWidth: Width,
              totalWidth: sceneTotalWidth ?? null,
            }),
          )
        );
      });
      if (!targetIds.length) return;

      await setConfigBatch(targetIds, { sinkType: basinStyle });
      dispatch(setActiveBasinStyle(basinStyle));
    },
    [
      activeMaterialTokens,
      activeThickness,
      basinCatalog,
      cabinetEntries,
      countertopRules,
      dimensionsByCabinet,
      dispatch,
      sceneTotalWidth,
      selectedDimensions.depth,
      selectedProducts,
    ],
  );

  return {
    hasSinkBase,
    styleOptions,
    activeStyleValue,
    isActiveStyleAvailable,
    isBasinSelectionVesselStyle,
    activeBasinOptionValue:
      isBasinSelectionVesselStyle && !activeBasinStyle ? VESSEL_SINK_NONE_OPTION_VALUE : activeBasinStyle,
    basinOptions,
    availableBasinOptions,
    applyIntegratedBasin,
  };
};
