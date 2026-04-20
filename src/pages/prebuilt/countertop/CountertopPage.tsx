import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  ProductOptionsGrid,
  type ProductOptionData,
  type ProductOptionMetadata,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopColorSku,
  getCountertopStyle,
  getVesselColor,
  getProductsPresets,
  getSelectedProducts,
  getSelectedDimensions,
  getSinkType,
} from "@/entities/product/model/store/selectors.ts";
import {
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setCountertopStyle,
  setCountertopColorSku,
  setVesselColor,
} from "@/entities/product/model/store/slice.ts";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useSyncedAccordionValue } from "@/shared/ui/Accordion/useSyncedAccordionValue";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux.ts";
import {
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import {
  resolveCountertopFallbackHex,
  resolveCountertopFallbackTexture,
  resolveCountertopNeedsLightBorder,
  sortCountertopOptionsByAvailability,
  useGetCountertopDatatableQuery,
} from "@/entities/countertop";
import { useGetConfiguratorQuery } from "@/entities";
import {
  buildCountertopRuleState,
  filterThicknessValuesByCountertopRules,
  getMaterialAliases,
  getCountertopRuleMaxWidthsForStyle,
  isIntegratedCountertopDepthRestrictedByMaterial,
  isCountertopRuleWidthAllowed,
  isRuleWidthEligibleForIntegratedContext,
  materialMatchesRule,
  matchesDepth,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
  resolveCountertopWidthRuleStyle,
  useCountertopRules,
} from "@/features/configurator-rule-core/countertop";

import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch.ts";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";
import {
  vesselAllowedMaterialsMap,
  buildCountertopColorSkuCandidates,
  extractColorCode,
  getCountertopMaterialTokensFromBasinType,
  resolveDefaultBasinByCountertopColor,
  resolveCountertopMaterialTokensFromCandidates,
  cmToInches,
} from "@/shared/lib/sku";

import s from "./CountertopPage.module.scss";
import { BaseButton } from "@/shared";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";
import { useSceneTotalWidthWithSidePanels } from "@/features/sidePanel";
import { useSinkBaseDimensions } from "@/shared/hooks/useSinkBaseDimensions";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { openSwatchOrder } from "@/features/swatchOrder";
import { normalizeProductConfigSnapshot } from "@/shared/lib/normalizeProductConfigSnapshot";

const COUNTERTOP_OPTION = "Counertops materials";
const MATERIAL_FILTER_DISABLED_REASON = "Not available for current cabinet size on scene";
const MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON = "Not available for current total cabinets width on scene";
const MATERIAL_FILTER_DEPTH_DISABLED_REASON = "Not available for current cabinet depth";
const MATERIAL_FILTER_WIDTH_DISABLED_REASON = "Not available for current cabinet width";
const EXCLUDED_COUNTERTOP_MATERIAL_FILTERS = new Set(["lacqueredmt", "lacqueredgl"]);
const isExcludedCountertopMaterialFilter = (value: string) =>
  EXCLUDED_COUNTERTOP_MATERIAL_FILTERS.has(normalizeMaterialToken(value));

const INTEGRATED_DEPTH_46_DISABLED_REASON =
  'Integrated basin style not available for 46cm (18.1") depth configurations';

type MaterialFilterOption = {
  label: string;
  value: string;
  disabled?: boolean;
  reason?: string;
  children?: MaterialFilterOption[];
};

export const CountertopPage = () => {
  const [searchParams] = useSearchParams();

  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const presetsProducts = useAppSelector(getProductsPresets);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const storedVesselColor = useAppSelector(getVesselColor);
  const activeBasinStyle = useAppSelector(getSinkType);

  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const sceneTotalWidth = useSceneTotalWidthWithSidePanels(selectedProducts, null);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts);
  const hasSelectedMaterial = Boolean(activeCountertopColor);
  const isVesselStyle = (activeCountertopStyle ?? "").trim().toLowerCase() === "vessel";
  const [hasSinkBase, setHasSinkBase] = useState(false);
  const isSinkDisabled = !hasSinkBase;
  const [activeVesselColor, setActiveVesselColor] = useState(storedVesselColor);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<MaterialFilterSelection>({});

  useEffect(() => {
    setActiveVesselColor(storedVesselColor);
  }, [storedVesselColor]);

  const { data: counterTopMaterials, isFetching: isFetchingcounterTopMaterials } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);

  // Remove unrelated text before ":" in the title
  const normalizeMaterialLabel = (value: string) => {
    const parts = value
      .split(":")
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : value;
  };

  const normalizeMaterialAlias = (value: string) => {
    const trimmed = value.trim();
    return trimmed.toLowerCase() === "tekorund" ? "Tekormud" : trimmed;
  };

  const toOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  const toStringArrayFromCsv = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  };
  const defaultMaterialFilters = useMemo(() => {
    const baseFilters = buildMaterialFilters(COUNTERTOP_OPTION);

    return {
      ...baseFilters,
      materials: baseFilters.materials.filter((option) => !isExcludedCountertopMaterialFilter(option.value)),
    };
  }, []);

  const getVariantMeta = useCallback(
    (variant: { metadata?: Record<string, unknown>; name: string; image?: string | null }) => {
      const meta = (variant.metadata ?? {}) as Record<string, unknown>;
      const nested =
        typeof meta.metadata === "object" && meta.metadata
          ? (meta.metadata as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const pick = (...values: unknown[]): string | undefined => {
        for (const v of values) {
          const str = toOptionalString(v);
          if (str) return str;
        }
        return undefined;
      };
      return {
        material: pick(nested.Material, meta.Material),
        color: pick(nested.Color, meta.Color),
        look: pick(nested.Look, meta.Look),
        codeColor: pick(nested.codeColor, nested.codecolor, meta.codeColor, meta.codecolor),
        hex: pick(nested.hex, meta.hex),
        image: pick(nested.image, meta.image, variant.image),
        value: pick(meta.value, nested.value, variant.name),
        label: pick(meta.label, meta.Label, nested.label, nested.Label, variant.name),
      };
    },
    [],
  );

  const countertopOptionsFromApi = useMemo(() => {
    const groups = (counterTopMaterials?.availableOptions ?? []).filter(
      (g) => g.proxyName === "Countertop Color" || g.proxyName === "Vessels",
    );

    if (!groups.length) return [];

    const buildMaterialTokens = (name: string, metaMaterial?: string, extraTokens: string[] = []) => {
      const tokens = new Set<string>();
      if (metaMaterial) {
        toStringArrayFromCsv(metaMaterial).forEach((token) => tokens.add(normalizeMaterialAlias(token)));
      }
      if (name) tokens.add(normalizeMaterialAlias(name));
      extraTokens.forEach((token) => {
        if (token) tokens.add(normalizeMaterialAlias(token));
      });

      const parts = name
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) tokens.add(normalizeMaterialAlias(parts[parts.length - 1]));
      return Array.from(tokens);
    };

    const seen = new Set<string>();

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .flatMap((variant) => {
            const normalizedName = variant.name.trim().toLowerCase();
            const normalizedMaterialName = (option.name ?? "").trim().toLowerCase();
            const normalizedProxyName = (group.proxyName ?? "").trim().toLowerCase();
            const dedupeKey = `${normalizedProxyName}::${normalizedMaterialName}::${normalizedName}`;
            if (seen.has(dedupeKey)) return [];
            seen.add(dedupeKey);

            const meta = getVariantMeta(variant);
            const metaMaterial = meta.material ?? option.name;
            const metaColor = meta.color;
            const metaLook = meta.look;
            const metaCodeColor = meta.codeColor?.trim();
            const metaHex = meta.hex;
            const descSource = option.name || group.proxyName || variant.name;

            const isCemento = variant.name.toLowerCase().startsWith("cemento");
            const baseColors = toStringArrayFromCsv(metaColor);
            const colors = baseColors.length > 0 ? baseColors : metaCodeColor ? [metaCodeColor] : [];

            const baseLooks = toStringArrayFromCsv(metaLook);
            const codeTokens = (metaCodeColor ?? "").split(/\s+/).filter(Boolean);
            const inferredLook =
              codeTokens.length > 1 && /^[A-Za-z]{2,3}$/.test(codeTokens[codeTokens.length - 1])
                ? codeTokens[codeTokens.length - 1]
                : undefined;
            const looks = baseLooks.length > 0 ? baseLooks : inferredLook ? [inferredLook] : [];

            return [
              {
                id: `${normalizedProxyName}:${option.id}:${variant.id}`,
                title: meta.label ?? variant.name,
                name: variant.name,
                sourceGroup: normalizedProxyName,
                desc: normalizeMaterialLabel(descSource),
                isShortDesc: false,
                metadata: {
                  image: meta.image ?? resolveCountertopFallbackTexture(variant.name),
                  value: meta.value ?? variant.name,
                  sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                  materials: buildMaterialTokens(option.name || variant.name, metaMaterial, [
                    ...(group.proxyName ? [group.proxyName] : []),
                    ...(isCemento ? ["Cemento"] : []),
                  ]),
                  colors,
                  looks,
                  hex: metaHex?.trim() ?? resolveCountertopFallbackHex(variant.name),
                  lightBorder: resolveCountertopNeedsLightBorder(variant.name),
                },
              },
            ];
          }),
      ),
    );
  }, [counterTopMaterials, getVariantMeta]);

  const isVesselApiOption = useCallback(
    (option: ProductOptionData & { sourceGroup?: string }) => option.sourceGroup === "vessels",
    [],
  );

  const isVesselCompatibleCountertopOption = useCallback(
    (option: ProductOptionData) => {
      if (isVesselApiOption(option)) return false;
      const allowed = new Set(["hpl", "porcelain", "tekorlux", "tal", "tam", "solidsurface"]);
      const materials = option.metadata?.materials ?? [];
      return materials.some((material) => getMaterialAliases(material).some((alias) => allowed.has(alias)));
    },
    [isVesselApiOption],
  );

  const isVesselColorOption = useCallback(
    (option: ProductOptionData) => isVesselApiOption(option) || isVesselCompatibleCountertopOption(option),
    [isVesselApiOption, isVesselCompatibleCountertopOption],
  );

  const countertopOptions = useMemo(
    () => countertopOptionsFromApi.filter((option) => !isVesselApiOption(option)),
    [countertopOptionsFromApi, isVesselApiOption],
  );

  const vesselColorOptions = useMemo(
    () => countertopOptionsFromApi.filter((option) => isVesselColorOption(option)),
    [countertopOptionsFromApi, isVesselColorOption],
  );

  const findSkuByColorName = useCallback(
    (colorName: string): string => {
      const materialSkuByToken: Record<string, string> = {
        fenix: "FX",
        hpl: "HPL",
        porcelain: "POR",
        glass: "GLSM",
        glassmt: "GLSM",
        glassgl: "GLSG",
        mineralmarmo: "SSMMO",
        minermalmaro: "SSMMO",
        ocritech: "SSOCR",
        tekorlux: "SSTKR",
        tekormud: "SSTM",
        tekorund: "SSTM",
      };

      for (const option of countertopOptionsFromApi) {
        if (option.metadata?.value === colorName || option.name === colorName) {
          const materials = option.metadata?.materials ?? [];
          for (const token of materials) {
            const mapped = materialSkuByToken[normalizeMaterialToken(token)];
            if (mapped) return mapped;
          }
          return option.metadata?.sku ?? "";
        }
      }
      return "";
    },
    [countertopOptionsFromApi],
  );

  const countertopRules = useCountertopRules();
  const countertopColorSkuCandidatesByValue = useMemo(
    () => buildCountertopColorSkuCandidates(counterTopMaterials?.availableOptions),
    [counterTopMaterials?.availableOptions],
  );

  const matrixMaterials = useMemo(() => {
    const set = new Set<string>();

    counterTopData?.rows?.forEach((row) => {
      const value = row.material?.trim();
      if (value) set.add(value);
    });

    return set;
  }, [counterTopData]);

  const normalizedMatrixMaterials = useMemo(
    () => new Set(Array.from(matrixMaterials).map((value) => normalizeMaterialToken(value))),
    [matrixMaterials],
  );

  const materialFilters = useMemo(() => {
    const groups = (counterTopMaterials?.availableOptions ?? []).filter((g) => g.proxyName === "Countertop Color");
    if (!groups.length) return defaultMaterialFilters;

    const materialSet = new Set<string>();
    const colorSet = new Set<string>();
    const lookSet = new Set<string>();
    const hexSet = new Set<string>();

    groups.forEach((group) => {
      group.options.forEach((option) => {
        option.variants?.forEach((variant) => {
          if (!variant.enabled) return;

          const meta = getVariantMeta(variant);
          const metaMaterial = meta.material ?? option.name;
          const metaColor = meta.color;
          const metaLook = meta.look;
          const metaHex = meta.hex;

          const candidateMaterials = [option.name, ...toStringArrayFromCsv(metaMaterial)]
            .filter(Boolean)
            .map((value) => normalizeMaterialAlias(value))
            .filter((value) => !isExcludedCountertopMaterialFilter(value)) as string[];

          if (!candidateMaterials.length) return;

          const matchesMatrix =
            normalizedMatrixMaterials.size === 0 ||
            candidateMaterials.some((value) =>
              getMaterialAliases(value).some((alias) => normalizedMatrixMaterials.has(alias)),
            );

          if (!matchesMatrix) return;

          candidateMaterials.forEach((value) => materialSet.add(value));

          if (variant.name.toLowerCase().startsWith("cemento")) {
            materialSet.add("Cemento");
          }

          toStringArrayFromCsv(metaColor).forEach((value) => colorSet.add(value));
          toStringArrayFromCsv(metaLook).forEach((value) => lookSet.add(value));
          if (metaHex) hexSet.add(metaHex.trim());
        });
      });
    });

    const toOptions = (set: Set<string>) =>
      Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ label: value, value }));

    return {
      materials: toOptions(materialSet),
      colors: toOptions(colorSet),
      looks: toOptions(lookSet),
      hex: toOptions(hexSet),
    };
  }, [counterTopMaterials, defaultMaterialFilters, normalizedMatrixMaterials, getVariantMeta]);

  const activeMaterialTokens = useMemo(() => {
    return resolveCountertopMaterialTokensFromCandidates({
      value: activeCountertopColor,
      candidatesByValue: countertopColorSkuCandidatesByValue,
      preferredSku: countertopColorSku,
      preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(activeBasinStyle),
    });
  }, [activeBasinStyle, activeCountertopColor, countertopColorSku, countertopColorSkuCandidatesByValue]);

  const activeVesselMaterialTokens = useMemo(() => {
    if (!activeVesselColor) return [];
    const match = vesselColorOptions.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      return candidate === activeVesselColor;
    });
    return match?.metadata?.materials ?? [];
  }, [activeVesselColor, vesselColorOptions]);

  const isDepth46VesselOnly = useMemo(() => {
    return isIntegratedCountertopDepthRestrictedByMaterial({
      activeMaterialTokens,
      depth: sinkBaseDims.depth ?? selectedDimensions.depth ?? null,
    });
  }, [activeMaterialTokens, selectedDimensions.depth, sinkBaseDims.depth]);

  const ruleState = useMemo(
    () =>
      buildCountertopRuleState({
        rules: countertopRules,
        activeMaterialTokens,
        width: sinkBaseDims.width ?? selectedDimensions.width,
        sinkBaseWidth: sinkBaseDims.width ?? selectedDimensions.width,
        totalWidth: sceneTotalWidth ?? selectedDimensions.width,
        depth: sinkBaseDims.depth ?? selectedDimensions.depth,
        activeBasinStyle,
        activeThickness,
      }),
    [
      activeBasinStyle,
      activeMaterialTokens,
      activeThickness,
      countertopRules,
      sinkBaseDims.depth,
      sinkBaseDims.width,
      selectedDimensions.depth,
      selectedDimensions.width,
      sceneTotalWidth,
    ],
  );

  const allowedMaterials = ruleState.allowedMaterials;

  const scopedCountertopOptions = useMemo(() => countertopOptions, [countertopOptions]);

  const displayedMaterialFilters = materialFilters;

  const filteredMaterialFilters = useMemo(
    () => ({
      ...displayedMaterialFilters,
      materials: groupMaterialsHierarchically(displayedMaterialFilters.materials),
    }),
    [displayedMaterialFilters],
  );

  const tierOptions = useMemo(() => buildTierFilterOptions(scopedCountertopOptions), [scopedCountertopOptions]);

  const vesselMaterialFilters = useMemo(() => {
    if (!vesselColorOptions.length) return defaultMaterialFilters;

    const materialSet = new Set<string>();
    const colorSet = new Set<string>();
    const lookSet = new Set<string>();
    const hexSet = new Set<string>();

    vesselColorOptions.forEach((option) => {
      if (!isVesselColorOption(option)) return;

      const vesselMaterial = (option.desc ?? "").trim();
      if (vesselMaterial) materialSet.add(normalizeMaterialAlias(vesselMaterial));
      (option.metadata?.colors ?? []).forEach((value) => colorSet.add(value));
      (option.metadata?.looks ?? []).forEach((value) => lookSet.add(value));
      const hex = option.metadata?.hex?.trim();
      if (hex) hexSet.add(hex);
    });
    // Explicit vessel-related countertop material filters requested by product.
    materialSet.add("HPL");
    materialSet.add("Porcelain");
    materialSet.add("Tekorlux");

    const toOptions = (set: Set<string>) =>
      Array.from(set)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ label: value, value }));

    return {
      materials: toOptions(materialSet),
      colors: toOptions(colorSet),
      looks: toOptions(lookSet),
      hex: toOptions(hexSet),
    };
  }, [defaultMaterialFilters, isVesselColorOption, vesselColorOptions]);

  const filteredVesselMaterialFilters = useMemo(
    () => ({
      ...vesselMaterialFilters,
      materials: groupMaterialsHierarchically(vesselMaterialFilters.materials).map((option) => {
        if (!option.children?.length) return option;
        const parentToken = normalizeMaterialToken(option.value);
        const children = option.children.filter((child) => normalizeMaterialToken(child.value) !== parentToken);
        return { ...option, children };
      }),
    }),
    [vesselMaterialFilters],
  );

  const vesselTierOptions = useMemo(() => buildTierFilterOptions(vesselColorOptions), [vesselColorOptions]);

  const selectedVesselMaterialValues = useMemo(() => {
    const selected = selectedVesselFilter.material;
    if (!selected) return [];

    const findOptionInTree = (
      options: Array<{ value: string; children?: Array<{ value: string }> }>,
      target: string,
    ): { value: string; children?: Array<{ value: string }> } | null => {
      for (const option of options) {
        if (option.value === target) return option;
        if (option.children?.length) {
          const found = findOptionInTree(
            option.children.map((child) => ({ value: child.value })),
            target,
          );
          if (found) return found;
        }
      }
      return null;
    };

    const selectedNode = findOptionInTree(filteredVesselMaterialFilters.materials, selected);
    if (selectedNode?.children?.length) {
      return [selectedNode.value, ...selectedNode.children.map((child) => child.value)];
    }

    return [selected];
  }, [filteredVesselMaterialFilters.materials, selectedVesselFilter.material]);

  const filteredVesselColorOptions = useMemo(() => {
    const getOptionMaterialTokens = (option: ProductOptionData): Set<string> => {
      const tokens = new Set<string>();
      const add = (raw?: string) => {
        if (!raw) return;
        const normalized = normalizeMaterialToken(raw);
        if (normalized) tokens.add(normalized);
        raw
          .split(/[\\/,&]/g)
          .map((chunk) => normalizeMaterialToken(chunk))
          .filter(Boolean)
          .forEach((chunk) => tokens.add(chunk));
      };

      add(option.desc ?? "");
      (option.metadata?.materials ?? []).forEach((material) => {
        add(material);
        getMaterialAliases(material).forEach((alias) => tokens.add(alias));
      });
      return tokens;
    };

    const getSelectedMaterialTokens = (selectedMaterial: string): Set<string> => {
      const normalized = normalizeMaterialToken(selectedMaterial);
      const tokens = new Set<string>([normalized, ...getMaterialAliases(selectedMaterial)]);

      if (normalized === "hpl") tokens.add("hplfenix");
      if (normalized === "fenix") tokens.add("hplfenix");
      if (normalized === "tekorlux") {
        tokens.add("tal");
        tokens.add("tam");
      }

      return tokens;
    };

    const vesselMaterialsMatchSelection = (option: ProductOptionData, selectedMaterial: string) => {
      const optionTokens = getOptionMaterialTokens(option);
      const selectedTokens = getSelectedMaterialTokens(selectedMaterial);
      return Array.from(optionTokens).some((token) => selectedTokens.has(token));
    };

    const vesselOnlyOptions = vesselColorOptions.filter((option) => isVesselColorOption(option));
    const hasTekorluxSelection = normalizeMaterialToken(selectedVesselFilter.material ?? "") === "tekorlux";

    const filteredByUiBase = filterOptionsByMaterialSelection(vesselOnlyOptions, {
      ...selectedVesselFilter,
      material: undefined,
    });
    const filteredByUi =
      selectedVesselMaterialValues.length === 0
        ? filteredByUiBase
        : hasTekorluxSelection
          ? filteredByUiBase.filter((option) => {
              const optionDesc = normalizeMaterialToken(option.desc ?? "");
              const optionMaterials = option.metadata?.materials ?? [];
              return (
                optionDesc === "tekorlux" ||
                optionMaterials.some((optionMaterial) => normalizeMaterialToken(optionMaterial) === "tekorlux")
              );
            })
          : filteredByUiBase.filter((option) => {
              return selectedVesselMaterialValues.some((selectedMaterial) =>
                vesselMaterialsMatchSelection(option, selectedMaterial),
              );
            });

    return filterOptionsByTier(filteredByUi, selectedVesselFilter.tier);
  }, [isVesselColorOption, selectedVesselFilter, selectedVesselMaterialValues, vesselColorOptions]);

  const selectedMaterialValues = useMemo(() => {
    const selected = selectedFilter.material;
    if (!selected) return [];

    const findOptionInTree = (
      options: Array<{ value: string; children?: Array<{ value: string }> }>,
      target: string,
    ): { value: string; children?: Array<{ value: string }> } | null => {
      for (const option of options) {
        if (option.value === target) return option;
        if (option.children?.length) {
          const found = findOptionInTree(
            option.children.map((child) => ({ value: child.value })),
            target,
          );
          if (found) return found;
        }
      }
      return null;
    };

    const selectedNode = findOptionInTree(filteredMaterialFilters.materials, selected);
    if (selectedNode?.children?.length) {
      return selectedNode.children.map((child) => child.value);
    }

    return [selected];
  }, [filteredMaterialFilters.materials, selectedFilter.material]);

  const materialsMatchSelection = useCallback((optionMaterial: string, selectedMaterial: string) => {
    const optionNormalized = normalizeMaterialToken(optionMaterial);
    const selectedNormalized = normalizeMaterialToken(selectedMaterial);

    if (optionNormalized === selectedNormalized) return true;

    const optionAliases = getMaterialAliases(optionMaterial);
    const selectedAliases = getMaterialAliases(selectedMaterial);

    return optionAliases.includes(selectedNormalized) || selectedAliases.includes(optionNormalized);
  }, []);

  const evaluateMaterialOptionCompatibility = useCallback(
    (option: ProductOptionData): { isCompatible: boolean; failedBy: "total" | "selected" | "depth" | null } => {
      const optionMaterials = option.metadata?.materials ?? [];
      if (!optionMaterials.length) return { isCompatible: true, failedBy: null };

      // Use SB cabinet depth for rule filtering; fall back to selected entity depth
      const effectiveDepth = sinkBaseDims.depth ?? selectedDimensions.depth ?? null;
      const totalWidth = sceneTotalWidth;
      // Use SB cabinet width for minSbCm validation instead of any clicked entity
      const sbWidth = sinkBaseDims.width;
      const widthRuleStyle = resolveCountertopWidthRuleStyle({
        activeCountertopStyle,
        activeBasinStyle,
      });

      const materialMatchingRules = countertopRules.filter((rule) =>
        optionMaterials.some((material) => materialMatchesRule(material, rule.material)),
      );
      const applicableRules = materialMatchingRules.filter((rule) => matchesDepth(rule, effectiveDepth));

      if (!applicableRules.length) {
        if (materialMatchingRules.length > 0) {
          return { isCompatible: false, failedBy: "depth" };
        }
        const hasCeramicMaterial = optionMaterials.some((material) => normalizeMaterialToken(material) === "ceramic");
        return { isCompatible: hasCeramicMaterial, failedBy: hasCeramicMaterial ? null : "total" };
      }

      const matchesWidth = (width: number, context: "total" | "sb") =>
        applicableRules.some((rule) => {
          return isCountertopRuleWidthAllowed({
            rule,
            width,
            style: widthRuleStyle,
            context: context === "sb" ? "sink-base" : "generic",
          });
        });

      if (typeof sbWidth === "number" && !matchesWidth(sbWidth, "sb")) {
        return { isCompatible: false, failedBy: "selected" };
      }

      if (typeof totalWidth === "number" && !matchesWidth(totalWidth, "total")) {
        return { isCompatible: false, failedBy: "total" };
      }

      return { isCompatible: true, failedBy: null };
    },
    [
      activeBasinStyle,
      activeCountertopStyle,
      countertopRules,
      sceneTotalWidth,
      sinkBaseDims.depth,
      sinkBaseDims.width,
      selectedDimensions.depth,
    ],
  );

  const isMaterialOptionCompatibleBySceneSize = useCallback(
    (option: ProductOptionData) => {
      return evaluateMaterialOptionCompatibility(option).isCompatible;
    },
    [evaluateMaterialOptionCompatibility],
  );

  const getMaterialOptionDisabledReason = useCallback(
    (option: ProductOptionData) => {
      const evaluation = evaluateMaterialOptionCompatibility(option);
      if (evaluation.isCompatible) return undefined;
      if (evaluation.failedBy === "total") {
        return "Not available for current total cabinets width on scene";
      }
      if (evaluation.failedBy === "depth") {
        return "Not available for current cabinet depth";
      }
      if (evaluation.failedBy === "selected") {
        return "Not available for current cabinet width";
      }
      return "Not available for selected cabinet width/depth/thickness on scene";
    },
    [evaluateMaterialOptionCompatibility],
  );

  const hasAnyCompatibleOptionForMaterialFilter = useCallback(
    (materialValue: string) =>
      scopedCountertopOptions.some((option) => {
        if (!isMaterialOptionCompatibleBySceneSize(option)) return false;
        const materials = option.metadata?.materials ?? [];
        return materials.some((optionMaterial) => materialsMatchSelection(optionMaterial, materialValue));
      }),
    [isMaterialOptionCompatibleBySceneSize, materialsMatchSelection, scopedCountertopOptions],
  );

  const getMaterialMaxWidthForCurrentDepth = useCallback(
    (materialValue: string): number | null => {
      const selectedDepth = selectedDimensions.depth ?? null;
      const widthRuleStyle = resolveCountertopWidthRuleStyle({
        activeCountertopStyle,
        activeBasinStyle,
      });

      const relevantRules = countertopRules.filter((rule) => {
        if (!matchesDepth(rule, selectedDepth)) return false;
        return materialMatchesRule(materialValue, rule.material);
      });
      if (!relevantRules.length) return null;

      const maxLimits = relevantRules
        .flatMap((rule) => getCountertopRuleMaxWidthsForStyle(rule, widthRuleStyle))
        .filter((value) => Number.isFinite(value));

      if (!maxLimits.length) return null;
      return Math.max(...maxLimits);
    },
    [activeBasinStyle, activeCountertopStyle, countertopRules, selectedDimensions.depth],
  );

  const getMaterialFilterDisabledReason = useCallback(
    (materialValue: string) => {
      const matchingOptions = scopedCountertopOptions.filter((option) => {
        const materials = option.metadata?.materials ?? [];
        return materials.some((optionMaterial) => materialsMatchSelection(optionMaterial, materialValue));
      });

      if (!matchingOptions.length) return MATERIAL_FILTER_DISABLED_REASON;

      const evaluations = matchingOptions.map((option) => evaluateMaterialOptionCompatibility(option));
      if (evaluations.some((item) => item.isCompatible)) return undefined;

      const hasDepthFailure = evaluations.some((item) => item.failedBy === "depth");
      if (hasDepthFailure && evaluations.every((item) => item.failedBy === "depth")) {
        return MATERIAL_FILTER_DEPTH_DISABLED_REASON;
      }

      const hasTotalFailure = evaluations.some((item) => item.failedBy === "total");
      if (hasTotalFailure) {
        const maxWidth = getMaterialMaxWidthForCurrentDepth(materialValue);
        const currentTotalWidth = sceneTotalWidth;
        if (maxWidth !== null && typeof currentTotalWidth === "number") {
          return `${MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON}. Current ${currentTotalWidth} cm (${cmToInches(currentTotalWidth)}"), ${materialValue} max ${maxWidth} cm (${cmToInches(maxWidth)}").`;
        }
        if (maxWidth !== null) {
          return `${MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON}. ${materialValue} max ${maxWidth} cm (${cmToInches(maxWidth)}").`;
        }
        return MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON;
      }

      const hasSelectedFailure = evaluations.some((item) => item.failedBy === "selected");
      if (hasSelectedFailure) return MATERIAL_FILTER_WIDTH_DISABLED_REASON;

      return MATERIAL_FILTER_DISABLED_REASON;
    },
    [
      evaluateMaterialOptionCompatibility,
      getMaterialMaxWidthForCurrentDepth,
      materialsMatchSelection,
      sceneTotalWidth,
      scopedCountertopOptions,
    ],
  );

  const materialFilterOptions = useMemo(() => {
    const annotate = (option: MaterialFilterOption): MaterialFilterOption => {
      if (option.children?.length) {
        const children = option.children.map((child) => annotate(child));
        const isDisabled = children.every((child) => child.disabled);
        const childReasons = children
          .map((child) => child.reason)
          .filter((reason): reason is string => Boolean(reason));
        const totalWidthReason = childReasons.find((reason) =>
          reason.startsWith(MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON),
        );
        const selectedSizeReason = childReasons.find((reason) => reason === MATERIAL_FILTER_DISABLED_REASON);
        const depthReason =
          childReasons.length > 0 && childReasons.every((reason) => reason === MATERIAL_FILTER_DEPTH_DISABLED_REASON)
            ? MATERIAL_FILTER_DEPTH_DISABLED_REASON
            : undefined;
        const firstChildReason = childReasons[0];
        return {
          ...option,
          children,
          disabled: isDisabled,
          reason: isDisabled
            ? (depthReason ??
              totalWidthReason ??
              selectedSizeReason ??
              firstChildReason ??
              MATERIAL_FILTER_DISABLED_REASON)
            : undefined,
        };
      }

      const isAvailable = hasAnyCompatibleOptionForMaterialFilter(option.value);
      const reason = !isAvailable ? getMaterialFilterDisabledReason(option.value) : undefined;
      return {
        ...option,
        disabled: !isAvailable,
        reason,
      };
    };

    return (filteredMaterialFilters.materials as MaterialFilterOption[]).map((option) => annotate(option));
  }, [filteredMaterialFilters.materials, getMaterialFilterDisabledReason, hasAnyCompatibleOptionForMaterialFilter]);

  const filteredCountertopOptions = useMemo(() => {
    const filteredByUiBase = filterOptionsByMaterialSelection(scopedCountertopOptions, {
      ...selectedFilter,
      material: undefined,
    });
    const filteredByUi =
      selectedMaterialValues.length === 0
        ? filteredByUiBase
        : filteredByUiBase.filter((option) => {
            const materials = option.metadata?.materials ?? [];
            return selectedMaterialValues.some((selectedMaterial) =>
              materials.some((optionMaterial) => materialsMatchSelection(optionMaterial, selectedMaterial)),
            );
          });

    const tierFiltered = filterOptionsByTier(filteredByUi, selectedFilter.tier);

    return tierFiltered.map((option) => {
      const isAvailable = isMaterialOptionCompatibleBySceneSize(option);
      return {
        ...option,
        isAvailable,
        disabledReason: isAvailable ? undefined : getMaterialOptionDisabledReason(option),
      };
    });
  }, [
    getMaterialOptionDisabledReason,
    isMaterialOptionCompatibleBySceneSize,
    materialsMatchSelection,
    scopedCountertopOptions,
    selectedFilter,
    selectedMaterialValues,
  ]);

  const filteredThicknessOptions = useMemo(() => {
    const filteredValues = filterThicknessValuesByCountertopRules({
      values: optionsMockData4.map((option) => option.value ?? option.title),
      allowedThicknesses: ruleState.allowedThicknesses,
    });

    if (filteredValues.length === optionsMockData4.length) return optionsMockData4;

    const allowedThicknessValues = new Set(filteredValues.map((value) => String(value)));
    return optionsMockData4.filter((option) => allowedThicknessValues.has(option.value ?? option.title));
  }, [ruleState.allowedThicknesses]);

  const filteredStyleOptions = useMemo(
    () =>
      optionsMockData2.map((option) => {
        const normalizedStyle = option.title.trim().toLowerCase();
        const isIntegrated = normalizedStyle === "integrated";
        const styleState =
          normalizedStyle === "integrated" || normalizedStyle === "vessel" || normalizedStyle === "undermount"
            ? ruleState.styleAvailability[normalizedStyle]
            : null;
        const blockedByRules = styleState ? !styleState.isAvailable : false;
        const blockedByDepth = isDepth46VesselOnly && isIntegrated && styleState?.isAvailable !== true;
        const isAvailable = !(blockedByDepth || blockedByRules);

        return {
          ...option,
          isAvailable,
          disabledReason: blockedByDepth
            ? INTEGRATED_DEPTH_46_DISABLED_REASON
            : blockedByRules
              ? styleState?.disabledReason
              : undefined,
        };
      }),
    [isDepth46VesselOnly, ruleState.styleAvailability],
  );
  const isActiveCountertopStyleAvailable = useMemo(() => {
    const normalizedActiveStyle = activeCountertopStyle?.trim().toLowerCase() ?? "";
    if (!normalizedActiveStyle) return false;

    return filteredStyleOptions.some((option) => {
      if (option.isAvailable === false) return false;
      return option.title.trim().toLowerCase() === normalizedActiveStyle;
    });
  }, [activeCountertopStyle, filteredStyleOptions]);
  const basinSelectionStyle = useMemo(() => {
    if (isActiveCountertopStyleAvailable) {
      return activeCountertopStyle?.trim().toLowerCase() ?? "";
    }

    const firstAvailable = filteredStyleOptions.find((option) => option.isAvailable !== false);
    return firstAvailable?.title?.trim().toLowerCase() ?? "";
  }, [activeCountertopStyle, filteredStyleOptions, isActiveCountertopStyleAvailable]);
  const isBasinSelectionVesselStyle = basinSelectionStyle === "vessel";

  const allowedBasinTokens = useMemo(() => {
    return ruleState.allowedBasinTokens;
  }, [ruleState.allowedBasinTokens]);
  const allowedBasinKeys = useMemo(() => {
    return ruleState.allowedBasinKeys;
  }, [ruleState.allowedBasinKeys]);

  const filteredBasinOptions = useMemo<ProductOptionData[]>(() => {
    if (!optionsMockData3.length) return [];

    const normalizedStyle = basinSelectionStyle;
    const allowedStyles = ruleState.allowedStyles;
    const activeMaterialsSource =
      normalizedStyle === "vessel" && activeVesselMaterialTokens.length > 0
        ? activeVesselMaterialTokens
        : activeMaterialTokens;
    const normalizedActiveMaterials = activeMaterialsSource.map((material) => normalizeMaterialToken(material));
    console.log("[BASIN/DEBUG][prebuilt][start]", {
      normalizedStyle,
      activeCountertopColor,
      activeThickness,
      activeBasinStyle,
      normalizedActiveMaterials,
      allowedMaterials: Array.from(allowedMaterials),
      allowedBasinTokens: Array.from(allowedBasinTokens),
      allowedStyles: Array.from(allowedStyles),
    });

    const vesselSinkNames = new Set([
      "Vessel_Blade11",
      "Vessel_Blade18",
      "Vessel_UrbanModo",
      "Vessel_UrbanMorris",
      "Vessel_Aquarius",
    ]);

    const integratedSinkNames = new Set([
      "Top_HPLPrisma",
      "Top_Glass_Nettuno",
      "Top_HPLQuadra",
      "Top_HPLCover",
      "Top_HPLStrip",
      "Top_HPL/Fenix_Cover_Gres",
      "Top_HPL/Fenix_Prisma_Gres",
      "Top_HPL/Fenix_Quadra_Gres",
      "Top_HPL/Fenix_Strip_Gres",
      "Fenix_Strip_Gres",
      "Top_Glass_Ovale",
      "Top_Mineralmarmo_Diamond",
      "Top_Ocritech_Oly55",
      "Top_Ocritech_Oly56",
      "Top_Ocritech_Orion",
      "Top_Ocritech_Quadra",
      "Top_Ocritech_Rayo",
      "Top_Ocritech_Roll",
      "Top_Porcelain_Cover",
      "Top_Porcelain_Prisma",
      "Top_Porcelain_Quadra",
      "Top_Porcelain_Strip",
      "Top_Tekorlux_Syntesi",
      "Top_Tekorlux_Quadra",
      "Top_Tekorlux_Rectangular",
      "Top_Tekorlux_Ron",
      "Top_Tekorlux_Trip",
      "Top_Tekormud_Tivi",
    ]);

    if (normalizedStyle === "vessel") {
      if (allowedStyles.size && !allowedStyles.has("vessel")) return [];

      const effectiveVesselColor = activeVesselColor || activeCountertopColor;
      const activeColorCode = effectiveVesselColor
        ? normalizeMaterialToken(extractColorCode(effectiveVesselColor) ?? "")
        : null;

      const vesselOptions = optionsMockData3.filter((option) => {
        const name = option.name ?? "";
        if (!vesselSinkNames.has(name)) return false;
        if (!normalizedActiveMaterials.length) return true;

        const allowedMats = vesselAllowedMaterialsMap[name];
        if (allowedMats === null || allowedMats === undefined) return true;
        return allowedMats.some((mat) => normalizedActiveMaterials.includes(mat) || mat === activeColorCode);
      });

      console.log("[BASIN/DEBUG][prebuilt][vessel]", {
        normalizedStyle,
        activeCountertopColor,
        activeThickness,
        activeBasinStyle,
        normalizedActiveMaterials,
        allowedStyles: Array.from(allowedStyles),
        vesselOptions: vesselOptions.map((item) => item.name ?? item.title),
      });

      return vesselOptions;
    }

    const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
    const applicableIntegratedRules = ruleState.matchingRules.filter((rule) => {
      if (activeThicknessValue === null) return true;

      return rule.topThicknesses
        .map((value) => parseThicknessValue(value))
        .filter((value): value is number => value !== null)
        .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
    });
    const integratedWidthContext = {
      sinkBaseWidth: sinkBaseDims.width ?? selectedDimensions.width ?? null,
      totalWidth: sceneTotalWidth ?? selectedDimensions.width ?? null,
    };
    const formatDisabledReason = (basinRules: typeof applicableIntegratedRules): string => {
      const currentTotalWidth = integratedWidthContext.totalWidth;
      const maxIntegrated = basinRules
        .map((rule) => rule.maxIntegratedCm)
        .filter((value): value is number => value !== null);
      if (typeof currentTotalWidth === "number" && maxIntegrated.length > 0) {
        const maxAllowed = Math.max(...maxIntegrated);
        if (currentTotalWidth > maxAllowed + 0.01) {
          return `Not available for current total cabinets width on scene. Current ${currentTotalWidth} cm (${cmToInches(currentTotalWidth)}"), max ${maxAllowed} cm (${cmToInches(maxAllowed)}").`;
        }
      }

      const currentSinkBaseWidth = integratedWidthContext.sinkBaseWidth;
      const minSinkBase = basinRules.map((rule) => rule.minSbCm).filter((value): value is number => value !== null);
      if (typeof currentSinkBaseWidth === "number" && minSinkBase.length > 0) {
        const minAllowed = Math.min(...minSinkBase);
        if (currentSinkBaseWidth + 0.01 < minAllowed) {
          return `Not available for current sink base width. Current ${currentSinkBaseWidth} cm (${cmToInches(currentSinkBaseWidth)}"), minimum ${minAllowed} cm (${cmToInches(minAllowed)}").`;
        }
      }

      const allowedSinkBaseWidths = Array.from(
        new Set(basinRules.flatMap((rule) => rule.integratedAllowedSizesOnly)),
      ).sort((left, right) => left - right);
      if (
        typeof currentSinkBaseWidth === "number" &&
        allowedSinkBaseWidths.length > 0 &&
        !allowedSinkBaseWidths.some((value) => Math.abs(value - currentSinkBaseWidth) < 0.01)
      ) {
        const formattedAllowed = allowedSinkBaseWidths.map((value) => `${value} cm (${cmToInches(value)}")`).join(", ");
        return `Not available for current sink base width. Allowed widths: ${formattedAllowed}.`;
      }

      return "Not available for selected cabinet width/depth/thickness on scene";
    };

    const integratedOptions = optionsMockData3.flatMap((option) => {
      if (!integratedSinkNames.has(option.name ?? "")) return [];
      const label = option.title ?? option.name ?? "";
      if (!label) return [];

      const [firstToken, ...restTokens] = label.trim().split(/\s+/);
      const materialTokens = firstToken
        ? firstToken
            .split("/")
            .map((token) => normalizeMaterialToken(token))
            .filter(Boolean)
        : [];
      const isMaterialSpecific = materialTokens.some((token) =>
        getMaterialAliases(token).some((alias) => allowedMaterials.has(alias)),
      );

      if (isMaterialSpecific && normalizedActiveMaterials.length > 0) {
        const matchesMaterial = materialTokens.some((token) =>
          getMaterialAliases(token).some((alias) => normalizedActiveMaterials.includes(alias)),
        );
        if (!matchesMaterial) return [];
      }

      const basinLabel = isMaterialSpecific ? restTokens.join(" ") : label;
      const normalized = normalizeBasinKey(basinLabel);
      const basinRules = applicableIntegratedRules.filter((rule) => normalizeBasinKey(rule.basinStyle) === normalized);
      if (!basinRules.length) return [];

      const isAvailable = basinRules.some((rule) =>
        isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext),
      );

      return [
        {
          ...option,
          isAvailable,
          disabledReason: isAvailable ? undefined : formatDisabledReason(basinRules),
        },
      ];
    });

    console.log("[BASIN/DEBUG][prebuilt][integrated]", {
      normalizedStyle,
      activeCountertopColor,
      activeThickness,
      activeBasinStyle,
      normalizedActiveMaterials,
      allowedMaterials: Array.from(allowedMaterials),
      allowedBasinTokens: Array.from(allowedBasinTokens),
      allowedBasinKeys: Array.from(allowedBasinKeys),
      allowedStyles: Array.from(allowedStyles),
      integratedOptions: integratedOptions.map((item) => ({
        name: item.name ?? item.title,
        available: item.isAvailable !== false,
      })),
    });

    return integratedOptions;
  }, [
    activeCountertopColor,
    activeVesselColor,
    activeVesselMaterialTokens,
    activeMaterialTokens,
    allowedBasinKeys,
    allowedBasinTokens,
    allowedMaterials,
    ruleState.allowedStyles,
    ruleState.matchingRules,
    activeBasinStyle,
    activeThickness,
    basinSelectionStyle,
    sceneTotalWidth,
    selectedDimensions.width,
    sinkBaseDims.width,
  ]);
  const availableBasinOptions = useMemo(
    () => filteredBasinOptions.filter((option) => option.isAvailable !== false),
    [filteredBasinOptions],
  );

  const sortedCountertopOptions = useMemo(
    () => sortCountertopOptionsByAvailability(filteredCountertopOptions),
    [filteredCountertopOptions],
  );
  const fullModeCountertopOptions = useMemo(
    () => [...scopedCountertopOptions].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    [scopedCountertopOptions],
  );
  const sortedVesselColorOptions = useMemo(
    () => [...filteredVesselColorOptions].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    [filteredVesselColorOptions],
  );

  const containsSinkBase = useCallback((value: unknown, visited = new Set<unknown>()): boolean => {
    if (!value || visited.has(value)) return false;

    if (typeof value === "string") {
      const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return normalized.includes("sinkbase");
    }

    if (typeof value !== "object") return false;

    visited.add(value);

    if (Array.isArray(value)) {
      return value.some((entry) => containsSinkBase(entry, visited));
    }

    return Object.values(value as Record<string, unknown>).some((entry) => containsSinkBase(entry, visited));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadConfigs = async () => {
      const orderedIds = getOrderedProductIds(selectedProducts);
      if (!orderedIds.length) {
        if (isMounted) setHasSinkBase(false);
        return;
      }

      const configs = await Promise.all(orderedIds.map((id) => getConfig(id)));
      const hasSink = configs.some((config) => (config ? containsSinkBase(config) : false));

      if (isMounted) setHasSinkBase(hasSink);
    };

    loadConfigs();

    return () => {
      isMounted = false;
    };
  }, [selectedProducts, containsSinkBase]);

  const presetNames = presetsProducts.map((i) => i.name);

  const handleChangeCountertopColor = async (
    colorName: string,
    _config?: unknown,
    metadata?: ProductOptionMetadata,
  ) => {
    if (!colorName) return;
    await saveSnapshot();

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { CountertopColor: colorName });
    });

    dispatch(setActiveCountertopColor(colorName));
    dispatch(setCountertopColorSku(metadata?.sku ?? findSkuByColorName(colorName)));
  };

  const handleChangeVesselColor = async (colorName: string) => {
    if (!colorName) return;
    await saveSnapshot();

    await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: colorName });

    setActiveVesselColor(colorName);
    dispatch(setVesselColor(colorName));
  };

  const applyBasinStyleByDependencies = useCallback(
    async (basinStyle: string, selectedOnlyProductId?: string | null) => {
      if (!basinStyle) return;

      const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));
      const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
      const selectedDepth = selectedDimensions.depth ?? null;
      const basinOption = optionsMockData3.find((option) => (option.name ?? option.title) === basinStyle);
      const basinLabel = basinOption?.title ?? basinOption?.name ?? basinStyle;
      const basinKey = normalizeBasinKey(basinLabel);

      const applicableRules = countertopRules.filter((rule) => {
        if (!matchesDepth(rule, selectedDepth)) return false;

        if (activeThicknessValue !== null) {
          const matchesThickness = rule.topThicknesses
            .map((value) => parseThicknessValue(value))
            .filter((value): value is number => value !== null)
            .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
          if (!matchesThickness) return false;
        }

        if (!normalizedActiveMaterials.length) return true;
        return normalizedActiveMaterials.some((material) => materialMatchesRule(material, rule.material));
      });

      const basinRules = applicableRules.filter((rule) => normalizeBasinKey(rule.basinStyle) === basinKey);

      const canUseBasinAtWidth = (width: number | null) => {
        if (width === null) return false;

        return basinRules.some((rule) =>
          isRuleWidthEligibleForIntegratedContext(rule, {
            sinkBaseWidth: width,
            totalWidth: sceneTotalWidth ?? null,
          }),
        );
      };

      const orderedIds = getOrderedProductIds(selectedProducts);
      if (!orderedIds.length) return;

      const configs = await Promise.all(orderedIds.map((id) => getConfig(id)));
      const targetIds = orderedIds.filter((productId, index) => {
        const rawConfig = configs[index];
        if (!rawConfig || typeof rawConfig !== "object") return false;
        const config = rawConfig as Record<string, unknown>;
        if (!containsSinkBase(config)) return false;
        const normalizedConfig = normalizeProductConfigSnapshot({
          id: productId,
          raw: config,
          selectedDimensions,
        });
        return canUseBasinAtWidth(normalizedConfig.Width);
      });
      const finalTargetIds = selectedOnlyProductId
        ? targetIds.filter((productId) => productId === selectedOnlyProductId)
        : targetIds;

      if (!finalTargetIds.length) return;
      await setConfigBatch(finalTargetIds, { sinkType: basinStyle });
      dispatch(setActiveBasinStyle(basinStyle));
    },
    [
      activeMaterialTokens,
      activeThickness,
      countertopRules,
      selectedProducts,
      containsSinkBase,
      dispatch,
      sceneTotalWidth,
      selectedDimensions,
    ],
  );

  const handleAddBasinStyle = async (basinStyle: string) => {
    const selectedOption = filteredBasinOptions.find((option) => (option.name ?? option.title) === basinStyle);
    if (selectedOption?.isAvailable === false) return;

    await saveSnapshot();
    if (basinStyle.startsWith("Vessel_")) {
      if ((activeCountertopStyle ?? "").trim().toLowerCase() !== "vessel") {
        dispatch(setCountertopStyle("Vessel"));
      }
      // Toggle: clicking the already-selected vessel reverts to empty cutout
      if (activeBasinStyle === basinStyle) {
        await setConfigBatch({ productType: "Sink-Base" }, { sinkType: "Vessel" });
        dispatch(setActiveBasinStyle(""));
        return;
      }
      presetNames.forEach((productName) => {
        setConfigBatch({ productType: productName }, { sinkType: basinStyle });
      });
      if (activeVesselColor) {
        await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: activeVesselColor });
      }
      dispatch(setActiveBasinStyle(basinStyle));
      return;
    }
    await applyBasinStyleByDependencies(basinStyle);
  };

  const applyBasinStyleFallback = useCallback(
    async (basinStyle: string) => {
      if (!basinStyle) return;
      if (basinStyle.startsWith("Vessel_")) {
        presetNames.forEach((productName) => {
          setConfigBatch({ productType: productName }, { sinkType: basinStyle });
        });
        dispatch(setActiveBasinStyle(basinStyle));
        return;
      }
      await applyBasinStyleByDependencies(basinStyle);
    },
    [applyBasinStyleByDependencies, dispatch, presetNames],
  );

  const handleAddThickness = useCallback(
    async (thickness: string) => {
      await saveSnapshot();

      setConfigBatch({}, { Thickness: thickness });

      dispatch(setActiveCountertopThickness(thickness));
    },
    [dispatch, saveSnapshot],
  );

  useEffect(() => {
    if (!filteredThicknessOptions.length) return;

    const currentStillValid =
      activeThickness && filteredThicknessOptions.some((o) => (o.value ?? o.title) === activeThickness);

    if (!currentStillValid) {
      const first = filteredThicknessOptions[0];
      const value = first.value ?? first.title;
      handleAddThickness(value);
    }
  }, [filteredThicknessOptions, activeThickness, handleAddThickness]);

  useEffect(() => {
    if (!hasSelectedMaterial || !activeThickness || isSinkDisabled) return;
    if (!isActiveCountertopStyleAvailable) return;
    if (!availableBasinOptions.length) return;
    // Vessel style: user picks vessel manually (or leaves hole cutout empty)
    if (isVesselStyle) return;

    const currentStillValid =
      activeBasinStyle && availableBasinOptions.some((option) => (option.name ?? option.title) === activeBasinStyle);
    const colorDrivenDefaultBasin = resolveDefaultBasinByCountertopColor(activeCountertopColor);
    const hasColorDrivenDefault =
      !!colorDrivenDefaultBasin &&
      availableBasinOptions.some((option) => (option.name ?? option.title) === colorDrivenDefaultBasin);
    const currentBasinMaterialTokens = new Set(getCountertopMaterialTokensFromBasinType(activeBasinStyle));
    const defaultBasinMaterialTokens = getCountertopMaterialTokensFromBasinType(colorDrivenDefaultBasin);
    const isSameBasinMaterialFamily =
      defaultBasinMaterialTokens.length > 0 &&
      defaultBasinMaterialTokens.some((token) => currentBasinMaterialTokens.has(token));

    if (
      hasColorDrivenDefault &&
      (activeBasinStyle === "Top_HPLPrisma" || !activeBasinStyle || !currentStillValid || !isSameBasinMaterialFamily)
    ) {
      applyBasinStyleFallback(colorDrivenDefaultBasin!);
      return;
    }

    if (!currentStillValid) {
      const first = availableBasinOptions[0];
      const basinValue = first?.name ?? first?.title;
      if (basinValue) {
        applyBasinStyleFallback(basinValue);
      }
    }
  }, [
    activeBasinStyle,
    activeThickness,
    availableBasinOptions,
    applyBasinStyleFallback,
    hasSelectedMaterial,
    isSinkDisabled,
    isActiveCountertopStyleAvailable,
    isVesselStyle,
    activeCountertopColor,
  ]);

  const handleCountertopStyle = async (style: string) => {
    if (!style) return;
    await saveSnapshot();
    dispatch(setCountertopStyle(style));

    if (style.toLowerCase() === "vessel") {
      // Show hole cutout on countertop without any vessel model.
      // sinkType targets Sink-Base cabinets only (not OS/SC).
      await setConfigBatch({ productType: "Sink-Base" }, { sinkType: "Vessel" });
      dispatch(setActiveBasinStyle(""));
    } else {
      // Leaving vessel style — reset VesselColor so it doesn't persist
      await setConfigBatch({ productType: "Sink-Base" }, { VesselColor: "" });
      dispatch(setVesselColor(""));
    }
  };

  const clearAllFilters = () => {
    setSelectedFilter({});
  };
  const clearVesselFilters = () => {
    setSelectedVesselFilter({});
  };

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={materialFilterOptions}
        value={selectedFilter.material}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={displayedMaterialFilters.colors}
        value={selectedFilter.color}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={displayedMaterialFilters.looks}
        value={selectedFilter.look}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, look: value as string }))}
      />

      <FilterItem
        label="Price"
        options={tierOptions}
        value={selectedFilter.tier}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, tier: value as string | undefined }))}
      />

      {Object.values(selectedFilter).some(Boolean) && (
        <BaseButton variant="filterBtn" onClick={clearAllFilters}>
          Clear All
        </BaseButton>
      )}
    </FilterRow>
  );

  const renderVesselFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={filteredVesselMaterialFilters.materials}
        value={selectedVesselFilter.material}
        onSelect={(value) => setSelectedVesselFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={filteredVesselMaterialFilters.colors}
        value={selectedVesselFilter.color}
        onSelect={(value) => setSelectedVesselFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={filteredVesselMaterialFilters.looks}
        value={selectedVesselFilter.look}
        onSelect={(value) => setSelectedVesselFilter((prev) => ({ ...prev, look: value as string }))}
      />

      <FilterItem
        label="Price"
        options={vesselTierOptions}
        value={selectedVesselFilter.tier}
        onSelect={(value) => setSelectedVesselFilter((prev) => ({ ...prev, tier: value as string | undefined }))}
      />

      {Object.values(selectedVesselFilter).some(Boolean) && (
        <BaseButton variant="filterBtn" onClick={clearVesselFilters}>
          Clear All
        </BaseButton>
      )}
    </FilterRow>
  );

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "countertop-color",
      title: "Countertop Color",
      defaultOpen: true,
      content: (
        <>
          <ViewModePanel
            onOrderSwatches={() => dispatch(openSwatchOrder("Countertop Color"))}
            fullModeTitle="Countertop Color"
            fullModeOptions={fullModeCountertopOptions}
            fullModeActiveValue={activeCountertopColor}
            onFullModeSelect={handleChangeCountertopColor}
            fullModeGroupByDesc
            fullModeLoading={isFetchingcounterTopMaterials}
            fullModeMaterialFilterOptions={filteredMaterialFilters.materials}
            fullModeColorFilterOptions={displayedMaterialFilters.colors}
            fullModeLookFilterOptions={displayedMaterialFilters.looks}
            fullModeTierFilterOptions={tierOptions}
          />
          {renderFilters()}
          <ProductOptionsGrid
            data={sortedCountertopOptions}
            handleAdd={handleChangeCountertopColor}
            activeValue={activeCountertopColor}
            isLoading={isFetchingcounterTopMaterials}
            groupByDesc
          />
        </>
      ),
    },
    {
      id: "thickness",
      title: "Thickness",
      content: (
        <ProductSwatchesGrid
          data={filteredThicknessOptions}
          onSelectChange={(value) => value && handleAddThickness(value)}
          selectedValue={activeThickness}
        />
      ),
    },
    {
      id: "countertop-styles",
      title: "Countertop Style",
      content: (
        <ProductOptionsGrid
          data={filteredStyleOptions}
          handleAdd={handleCountertopStyle}
          activeValue={activeCountertopStyle}
        />
      ),
    },
    {
      id: "basin-style",
      title: isBasinSelectionVesselStyle ? "Vessel Style" : "Basin style",
      content: !hasSelectedMaterial ? (
        <div>Select a material first to enable basin styles.</div>
      ) : !activeThickness ? (
        <div>Select a thickness first to enable basin styles.</div>
      ) : isSinkDisabled ? (
        <div>Select a cabinet type with sink support to enable basin styles.</div>
      ) : filteredBasinOptions.length === 0 && isBasinSelectionVesselStyle ? (
        <div>No vessel styles available for the selected material.</div>
      ) : (
        <ProductOptionsGrid handleAdd={handleAddBasinStyle} data={filteredBasinOptions} />
      ),
    },
    ...(isVesselStyle
      ? [
          {
            id: "vessel-color",
            title: "Vessel Color",
            content: (
              <>
                {renderVesselFilters()}
                <ProductOptionsGrid
                  data={sortedVesselColorOptions}
                  handleAdd={handleChangeVesselColor}
                  activeValue={activeVesselColor}
                  isLoading={isFetchingcounterTopMaterials}
                  groupByDesc
                />
              </>
            ),
          } as AccordionConfig,
        ]
      : []),
  ];

  const defaultValue = ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString();
  const accordionValues = ACCORDIONS.map((accordion) => accordion.id);
  const { value: accordionValue, onValueChange: setAccordionValue } = useSyncedAccordionValue({
    values: accordionValues,
    defaultValue,
    requestedValue: searchParams.get("accordion"),
  });

  return (
    <div className="countertop">
      <ConfiguratorAccordionGroup defaultValue={defaultValue} value={accordionValue} onValueChange={setAccordionValue}>
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
