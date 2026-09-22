import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import {
  ProductOptionsGrid,
  type ProductOptionData,
  type ProductOptionMetadata,
} from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { dedupeProductOptionsByValue } from "@/entities/product/lib/dedupeProductOptionsByValue";
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
import { setCountertopColorSku } from "@/entities/product/model/store/slice.ts";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useCompactAccordionViewport } from "@/shared/ui/Accordion/useCompactAccordionViewport";
import { useSyncedAccordionValue } from "@/shared/ui/Accordion/useSyncedAccordionValue";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux.ts";
import {
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  materialFilterValuesMatch,
  resolveSelectedMaterialFilterValues,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import {
  resolveCountertopFallbackHex,
  resolveCountertopFallbackTexture,
  resolveCountertopNeedsLightBorder,
  sortCountertopOptionsByAvailability,
} from "@/entities/countertop";
import {
  buildCountertopRuleState,
  filterThicknessValuesByCountertopRules,
  getMaterialAliases,
  getCountertopRuleMaxWidthsForStyle,
  appendSyntesiCountertopOptions,
  isIntegratedCountertopDepthRestrictedByMaterial,
  isCountertopRuleWidthAllowed,
  isRuleWidthEligibleForIntegratedContext,
  materialMatchesRule,
  matchesDepthForStyle,
  extractCountertopBasinMaterialScopeTokens,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
  resolveCountertopCabinetCompositionConstraint,
  resolveCountertopWidthRuleStyle,
  REASON_SYNTESI_SINGLE_CABINET,
  REASON_VESSEL_COLOR_UNAVAILABLE,
  isMaterialCompatibleWithVesselStyle,
  isPreferredVesselFinish,
  isVisibleVesselSinkStyle,
  useCountertopRules,
  isVesselCompatibleCountertopMaterial,
  resolveIntegratedBasinUnavailableReason,
  selectMaterialAliasTable,
} from "@/features/configurator-rule-core/countertop";
import {
  selectAttribute,
  selectMaterialHierarchy,
  selectMessage,
  selectMessageOr,
  useActiveCollection,
} from "@/entities/collection";
import {
  buildBasinOptions,
  buildCountertopStyleOptions,
  buildThicknessOptions,
} from "@/features/collectionCustomization";
import { resolveCabinetDimensions, resolveStableKey } from "@/entities/configuration/model/identity";
import {
  getActiveProductProfile,
  getCabinetEntries,
  getDimensionsByCabinet,
} from "@/entities/configuration/model/store/selectors";

import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

import {
  buildCountertopColorSkuCandidates,
  extractColorCode,
  getCountertopMaterialTokensFromBasinType,
  resolveDefaultBasinForCountertopSelection,
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
import { trackModularOrderFreeSwatchesClick } from "@/shared/lib/analytics/modularKeyEvents";
import { useChangeAttribute } from "@/features/configurationCommands";

const COUNTERTOP_OPTION = "Counertops materials";
/** Reason codes of the collection; the English text below is the fallback while a collection has none. */
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
const NO_EXCLUDED_MATERIAL_FILTERS: readonly string[] = [];
/** Material filters the collection hides from the countertop step (`ruleData.countertopFallbacks`). */
const isExcludedCountertopMaterialFilter = (value: string, excludedTokens: readonly string[]) =>
  excludedTokens.includes(normalizeMaterialToken(value));

const REASON_INTEGRATED_DEPTH_RESTRICTED = "countertop.integratedDepthRestricted";
const FALLBACK_INTEGRATED_DEPTH_RESTRICTED = 'Integrated basin style not available for 46cm (18.1") depth configurations';
const VESSEL_SINK_NONE_OPTION_VALUE = "__vessel_sink_none__";
const VESSEL_SINK_NONE_OPTION: ProductOptionData = {
  id: "vessel-sink-none",
  title: "None",
  name: VESSEL_SINK_NONE_OPTION_VALUE,
  isShortDesc: false,
};

type MaterialFilterOption = {
  label: string;
  value: string;
  disabled?: boolean;
  reason?: string;
  children?: MaterialFilterOption[];
};

export const CountertopPage = () => {
  const { key: locationKey } = useLocation();
  const [searchParams] = useSearchParams();

  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const { change: changeAttributeValue } = useChangeAttribute();
  const presetsProducts = useAppSelector(getProductsPresets);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const activeProfile = useAppSelector(getActiveProductProfile);
  // Option lists of this step come from the active collection's profile (B06).
  const styleCatalog = useMemo(() => buildCountertopStyleOptions(activeProfile), [activeProfile]);
  const basinCatalog = useMemo(() => buildBasinOptions(activeProfile), [activeProfile]);
  const thicknessCatalog = useMemo(() => buildThicknessOptions(activeProfile), [activeProfile]);
  const materialHierarchy = useMemo(() => selectMaterialHierarchy(activeProfile), [activeProfile]);
  const materialAliasTable = useMemo(() => selectMaterialAliasTable(activeProfile), [activeProfile]);
  const excludedMaterialFilterTokens =
    activeProfile?.ruleData.countertopFallbacks?.excludedMaterialFilterTokens ?? NO_EXCLUDED_MATERIAL_FILTERS;
  const syntesiMaterial = activeProfile?.ruleData.syntesi?.material ?? null;
  const vesselColorUnavailableReason = selectMessage(activeProfile, REASON_VESSEL_COLOR_UNAVAILABLE);
  const syntesiSingleCabinetReason = selectMessage(activeProfile, REASON_SYNTESI_SINGLE_CABINET);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  // Texts of the active collection, with the page's previous English as the fallback (DEV-08).
  const MATERIAL_FILTER_DISABLED_REASON = selectMessageOr(activeProfile, REASON_MATERIAL_SIZE, FALLBACK_MATERIAL_SIZE);
  const MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON = selectMessageOr(
    activeProfile,
    REASON_MATERIAL_TOTAL_WIDTH,
    FALLBACK_MATERIAL_TOTAL_WIDTH,
  );
  const MATERIAL_FILTER_DEPTH_DISABLED_REASON = selectMessageOr(
    activeProfile,
    REASON_MATERIAL_DEPTH,
    FALLBACK_MATERIAL_DEPTH,
  );
  const MATERIAL_FILTER_WIDTH_DISABLED_REASON = selectMessageOr(
    activeProfile,
    REASON_MATERIAL_WIDTH,
    FALLBACK_MATERIAL_WIDTH,
  );
  const MATERIAL_FILTER_SELECTION_DISABLED_REASON = selectMessageOr(
    activeProfile,
    REASON_MATERIAL_SELECTION,
    FALLBACK_MATERIAL_SELECTION,
  );

  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const storedVesselColor = useAppSelector(getVesselColor);
  const activeBasinStyle = useAppSelector(getSinkType);

  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetEntries = useAppSelector(getCabinetEntries);
  const sinkBaseCabinetId = cabinetEntries.find(({ runtimeId }) =>
    runtimeId.toLowerCase().includes("sink-base"),
  )?.stableKey;
  const dimensionsByCabinet = useAppSelector(getDimensionsByCabinet);
  const sceneTotalWidth = useSceneTotalWidthWithSidePanels(selectedProducts, null);
  const sinkBaseDims = useSinkBaseDimensions(selectedProducts);
  const cabinetCompositionCount = selectedProducts.length > 0 ? selectedProducts.length : presetsProducts.length;
  const hasSelectedMaterial = Boolean(activeCountertopColor);
  // The active style as the profile spells it: a saved configuration may carry the legacy "Vessel".
  const countertopStyle = (activeCountertopStyle ?? "").trim().toLowerCase();
  const isVesselStyle = countertopStyle === "vessel";
  const [hasSinkBase, setHasSinkBase] = useState(false);
  const isSinkDisabled = !hasSinkBase;
  const [activeVesselColor, setActiveVesselColor] = useState(storedVesselColor);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<MaterialFilterSelection>({});

  useEffect(() => {
    setActiveVesselColor(storedVesselColor);
  }, [storedVesselColor]);

  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);

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
    const normalized = normalizeMaterialToken(trimmed);
    if (normalized === "tekorund") return "Tekormud";
    if (normalized === "sstkr" || normalized === "tal" || normalized === "tam") return "Tekorlux";
    return trimmed;
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
      materials: baseFilters.materials.filter(
        (option) => !isExcludedCountertopMaterialFilter(option.value, excludedMaterialFilterTokens),
      ),
    };
  }, [excludedMaterialFilterTokens]);

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

  const countertopRules = useCountertopRules();

  const countertopOptionsFromApi = useMemo(() => {
    const groups = configuratorGroups.filter((g) => g.proxyName === "Countertop Color" || g.proxyName === "Vessels");

    if (!groups.length) return appendSyntesiCountertopOptions([], countertopRules, activeProfile);

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

    const apiOptions = groups.flatMap((group) =>
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
                  codeColor: metaCodeColor,
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
    return appendSyntesiCountertopOptions(apiOptions, countertopRules, activeProfile);
  }, [activeProfile, configuratorGroups, countertopRules, getVariantMeta]);

  const isVesselApiOption = useCallback(
    (option: ProductOptionData & { sourceGroup?: string }) => option.sourceGroup === "vessels",
    [],
  );

  const isVesselCompatibleCountertopOption = useCallback(
    (option: ProductOptionData) => {
      if (isVesselApiOption(option)) return false;
      return isVesselCompatibleCountertopMaterial(option.metadata?.materials ?? [], activeProfile);
    },
    [activeProfile, isVesselApiOption],
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
    () =>
      dedupeProductOptionsByValue(
        countertopOptionsFromApi.filter((option) => isVesselColorOption(option)),
        (option) => (isVesselApiOption(option) ? 1 : 0),
      ),
    [countertopOptionsFromApi, isVesselApiOption, isVesselColorOption],
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
        tal: "SSTKR",
        tam: "SSTKR",
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

  const countertopColorSkuCandidatesByValue = useMemo(
    () => buildCountertopColorSkuCandidates(configuratorGroups),
    [configuratorGroups],
  );

  const matrixMaterials = useMemo(
    () => new Set(countertopRules.map(({ material }) => material.trim()).filter(Boolean)),
    [countertopRules],
  );

  const normalizedMatrixMaterials = useMemo(
    () => new Set(Array.from(matrixMaterials).map((value) => normalizeMaterialToken(value))),
    [matrixMaterials],
  );

  const materialFilters = useMemo(() => {
    const groups = configuratorGroups.filter((g) => g.proxyName === "Countertop Color");
    const syntesiOptions = countertopOptions.filter((option) =>
      option.metadata?.materials?.some(
        (material) =>
          syntesiMaterial !== null && normalizeMaterialToken(material) === normalizeMaterialToken(syntesiMaterial),
      ),
    );

    if (!groups.length && !syntesiOptions.length) return defaultMaterialFilters;

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
            .filter((value) => !isExcludedCountertopMaterialFilter(value, excludedMaterialFilterTokens)) as string[];

          if (!candidateMaterials.length) return;

          const matchesMatrix =
            normalizedMatrixMaterials.size === 0 ||
            candidateMaterials.some((value) =>
              getMaterialAliases(value, materialAliasTable).some((alias) => normalizedMatrixMaterials.has(alias)),
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

    syntesiOptions.forEach((option) => {
      if (syntesiMaterial) materialSet.add(syntesiMaterial);
      (option.metadata?.colors ?? []).forEach((value) => colorSet.add(value));
      (option.metadata?.looks ?? []).forEach((value) => lookSet.add(value));
      const hex = option.metadata?.hex?.trim();
      if (hex) hexSet.add(hex);
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
  }, [
    materialAliasTable,
    configuratorGroups,
    countertopOptions,
    defaultMaterialFilters,
    excludedMaterialFilterTokens,
    normalizedMatrixMaterials,
    getVariantMeta,
    syntesiMaterial,
  ]);

  const activeMaterialTokens = useMemo(() => {
    return resolveCountertopMaterialTokensFromCandidates({
      value: activeCountertopColor,
      candidatesByValue: countertopColorSkuCandidatesByValue,
      preferredSku: countertopColorSku,
      preferredMaterialTokens: getCountertopMaterialTokensFromBasinType(activeBasinStyle),
    });
  }, [activeBasinStyle, activeCountertopColor, countertopColorSku, countertopColorSkuCandidatesByValue]);

  const isDepth46VesselOnly = useMemo(() => {
    return isIntegratedCountertopDepthRestrictedByMaterial({
      activeMaterialTokens,
      depth: sinkBaseDims.depth ?? selectedDimensions.depth ?? null,
      profile: activeProfile,
    });
  }, [activeMaterialTokens, activeProfile, selectedDimensions.depth, sinkBaseDims.depth]);

  const ruleState = useMemo(
    () =>
      buildCountertopRuleState({
        rules: countertopRules,
        activeMaterialTokens,
        width: sinkBaseDims.width ?? selectedDimensions.width,
        sinkBaseWidth: sinkBaseDims.width ?? selectedDimensions.width,
        totalWidth: sceneTotalWidth ?? selectedDimensions.width,
        depth: sinkBaseDims.depth ?? selectedDimensions.depth,
        activeCountertopStyle,
        activeBasinStyle,
        activeThickness,
        profile: activeProfile,
      }),
    [
      activeProfile,
      activeBasinStyle,
      activeCountertopStyle,
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
      materials: groupMaterialsHierarchically(displayedMaterialFilters.materials, materialHierarchy),
    }),
    [displayedMaterialFilters, materialHierarchy],
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

  const vesselTierOptions = useMemo(() => buildTierFilterOptions(vesselColorOptions), [vesselColorOptions]);

  const getVesselOptionMaterialTokens = useCallback((option: ProductOptionData): string[] => {
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
      getMaterialAliases(material, materialAliasTable).forEach((alias) => tokens.add(alias));
    });

    return Array.from(tokens);
  }, [materialAliasTable, ]);

  const getSelectedVesselMaterialTokens = useCallback((selectedMaterial: string): Set<string> => {
    const normalized = normalizeMaterialToken(selectedMaterial);
    const tokens = new Set<string>([normalized, ...getMaterialAliases(selectedMaterial, materialAliasTable)]);

    if (normalized === "hpl") tokens.add("hplfenix");
    if (normalized === "fenix") tokens.add("hplfenix");
    if (normalized === "tekorlux") {
      tokens.add("tal");
      tokens.add("tam");
    }

    return tokens;
  }, [materialAliasTable, ]);

  const vesselMaterialsMatchSelection = useCallback(
    (option: ProductOptionData, selectedMaterial: string) => {
      const optionTokens = getVesselOptionMaterialTokens(option);
      const selectedTokens = getSelectedVesselMaterialTokens(selectedMaterial);
      return optionTokens.some((token) => selectedTokens.has(token));
    },
    [getSelectedVesselMaterialTokens, getVesselOptionMaterialTokens],
  );

  const getVesselOptionColorCode = useCallback((option: ProductOptionData): string | null => {
    return option.metadata?.codeColor ?? extractColorCode(option.metadata?.value ?? option.name ?? option.title);
  }, []);

  const isVesselColorCompatibleWithSinkStyle = useCallback(
    (option: ProductOptionData, vesselStyle = activeBasinStyle) =>
      isMaterialCompatibleWithVesselStyle({
        vesselStyle,
        materialTokens: getVesselOptionMaterialTokens(option),
        colorCode: getVesselOptionColorCode(option),
        profile: activeProfile,
      }),
    [activeBasinStyle, activeProfile, getVesselOptionColorCode, getVesselOptionMaterialTokens],
  );

  const isPreferredVesselColorForSinkStyle = useCallback(
    (option: ProductOptionData, vesselStyle: string) =>
      isPreferredVesselFinish({
        vesselStyle,
        materialTokens: getVesselOptionMaterialTokens(option),
        colorCode: getVesselOptionColorCode(option),
        profile: activeProfile,
      }),
    [activeProfile, getVesselOptionColorCode, getVesselOptionMaterialTokens],
  );

  const getVesselColorDisabledReason = useCallback(
    (option: ProductOptionData) =>
      isVesselColorCompatibleWithSinkStyle(option) ? undefined : vesselColorUnavailableReason,
    [isVesselColorCompatibleWithSinkStyle, vesselColorUnavailableReason],
  );

  const hasCompatibleVesselColorForMaterial = useCallback(
    (materialValue: string) =>
      vesselColorOptions.some((option) => {
        if (!isVesselColorOption(option)) return false;
        if (!vesselMaterialsMatchSelection(option, materialValue)) return false;
        return isVesselColorCompatibleWithSinkStyle(option);
      }),
    [isVesselColorCompatibleWithSinkStyle, isVesselColorOption, vesselColorOptions, vesselMaterialsMatchSelection],
  );

  const filteredVesselMaterialFilters = useMemo(() => {
    const annotate = (option: MaterialFilterOption): MaterialFilterOption => {
      if (option.children?.length) {
        const parentToken = normalizeMaterialToken(option.value);
        const children = option.children
          .filter((child) => normalizeMaterialToken(child.value) !== parentToken)
          .map((child) => annotate(child));
        const disabled = children.length > 0 && children.every((child) => child.disabled);

        return {
          ...option,
          children,
          disabled,
          reason: disabled ? vesselColorUnavailableReason : undefined,
        };
      }

      const disabled = !hasCompatibleVesselColorForMaterial(option.value);

      return {
        ...option,
        disabled,
        reason: disabled ? vesselColorUnavailableReason : undefined,
      };
    };

    return {
      ...vesselMaterialFilters,
      materials: groupMaterialsHierarchically(vesselMaterialFilters.materials, materialHierarchy).map((option) => annotate(option)),
    };
  }, [hasCompatibleVesselColorForMaterial, materialHierarchy, vesselColorUnavailableReason, vesselMaterialFilters]);

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
              return vesselMaterialsMatchSelection(option, selectedVesselFilter.material ?? "");
            })
          : filteredByUiBase.filter((option) => {
              return selectedVesselMaterialValues.some((selectedMaterial) =>
                vesselMaterialsMatchSelection(option, selectedMaterial),
              );
            });

    return filterOptionsByTier(filteredByUi, selectedVesselFilter.tier).map((option) => {
      const isAvailable = isVesselColorCompatibleWithSinkStyle(option);
      return {
        ...option,
        isAvailable,
        disabledReason: isAvailable ? undefined : getVesselColorDisabledReason(option),
      };
    });
  }, [
    getVesselColorDisabledReason,
    isVesselColorCompatibleWithSinkStyle,
    isVesselColorOption,
    selectedVesselFilter,
    selectedVesselMaterialValues,
    vesselColorOptions,
    vesselMaterialsMatchSelection,
  ]);

  const selectedMaterialValues = useMemo(() => {
    return resolveSelectedMaterialFilterValues(filteredMaterialFilters.materials, selectedFilter.material);
  }, [filteredMaterialFilters.materials, selectedFilter.material]);

  const materialsMatchSelection = useCallback((optionMaterial: string, selectedMaterial: string) => {
    return materialFilterValuesMatch(optionMaterial, selectedMaterial);
  }, []);

  const evaluateMaterialOptionCompatibility = useCallback(
    (
      option: ProductOptionData,
    ): { isCompatible: boolean; failedBy: "total" | "selected" | "depth" | "composition" | null } => {
      const optionMaterials = option.metadata?.materials ?? [];
      if (!optionMaterials.length) return { isCompatible: true, failedBy: null };

      const compositionConstraint = resolveCountertopCabinetCompositionConstraint({
        materialTokens: optionMaterials,
        cabinetCount: cabinetCompositionCount,
        profile: activeProfile,
      });
      if (!compositionConstraint.isWithinCabinetLimit) {
        return { isCompatible: false, failedBy: "composition" };
      }

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
        optionMaterials.some((material) => materialMatchesRule(material, rule.material, materialAliasTable)),
      );
      const applicableRules = materialMatchingRules.filter((rule) =>
        matchesDepthForStyle(rule, effectiveDepth, widthRuleStyle),
      );

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
            activeBasinStyle,
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
      materialAliasTable,
      activeBasinStyle,
      activeCountertopStyle,
      activeProfile,
      countertopRules,
      cabinetCompositionCount,
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
        return MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON;
      }
      if (evaluation.failedBy === "depth") {
        return MATERIAL_FILTER_DEPTH_DISABLED_REASON;
      }
      if (evaluation.failedBy === "selected") {
        return MATERIAL_FILTER_WIDTH_DISABLED_REASON;
      }
      if (evaluation.failedBy === "composition") {
        return syntesiSingleCabinetReason;
      }
      return MATERIAL_FILTER_SELECTION_DISABLED_REASON;
    },
    [
      evaluateMaterialOptionCompatibility,
      syntesiSingleCabinetReason,
      MATERIAL_FILTER_DEPTH_DISABLED_REASON,
      MATERIAL_FILTER_SELECTION_DISABLED_REASON,
      MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON,
      MATERIAL_FILTER_WIDTH_DISABLED_REASON,
    ],
  );

  /** The code of the same reason, so the interface can word it (DEV-08). */
  const getMaterialOptionDisabledReasonCode = useCallback(
    (option: ProductOptionData) => {
      const evaluation = evaluateMaterialOptionCompatibility(option);
      if (evaluation.isCompatible) return undefined;
      if (evaluation.failedBy === "total") return REASON_MATERIAL_TOTAL_WIDTH;
      if (evaluation.failedBy === "depth") return REASON_MATERIAL_DEPTH;
      if (evaluation.failedBy === "selected") return REASON_MATERIAL_WIDTH;
      if (evaluation.failedBy === "composition") return REASON_SYNTESI_SINGLE_CABINET;
      return REASON_MATERIAL_SELECTION;
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
        if (!matchesDepthForStyle(rule, selectedDepth, widthRuleStyle)) return false;
        return materialMatchesRule(materialValue, rule.material, materialAliasTable);
      });
      if (!relevantRules.length) return null;

      const maxLimits = relevantRules
        .flatMap((rule) => getCountertopRuleMaxWidthsForStyle(rule, widthRuleStyle))
        .filter((value) => Number.isFinite(value));

      if (!maxLimits.length) return null;
      return Math.max(...maxLimits);
    },
    [materialAliasTable, activeBasinStyle, activeCountertopStyle, countertopRules, selectedDimensions.depth],
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

      const hasCompositionFailure = evaluations.some((item) => item.failedBy === "composition");
      if (hasCompositionFailure) return syntesiSingleCabinetReason;

      return MATERIAL_FILTER_DISABLED_REASON;
    },
    [
      evaluateMaterialOptionCompatibility,
      getMaterialMaxWidthForCurrentDepth,
      materialsMatchSelection,
      sceneTotalWidth,
      scopedCountertopOptions,
      syntesiSingleCabinetReason,
      MATERIAL_FILTER_DEPTH_DISABLED_REASON,
      MATERIAL_FILTER_DISABLED_REASON,
      MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON,
      MATERIAL_FILTER_WIDTH_DISABLED_REASON,
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
  }, [
    filteredMaterialFilters.materials,
    getMaterialFilterDisabledReason,
    hasAnyCompatibleOptionForMaterialFilter,
    MATERIAL_FILTER_DEPTH_DISABLED_REASON,
    MATERIAL_FILTER_DISABLED_REASON,
    MATERIAL_FILTER_TOTAL_WIDTH_DISABLED_REASON,
  ]);

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
        disabledReasonCode: isAvailable ? undefined : getMaterialOptionDisabledReasonCode(option),
      };
    });
  }, [
    getMaterialOptionDisabledReason,
    getMaterialOptionDisabledReasonCode,
    isMaterialOptionCompatibleBySceneSize,
    materialsMatchSelection,
    scopedCountertopOptions,
    selectedFilter,
    selectedMaterialValues,
  ]);

  const filteredThicknessOptions = useMemo(() => {
    const filteredValues = filterThicknessValuesByCountertopRules({
      values: thicknessCatalog.map((option) => option.value ?? option.title),
      allowedThicknesses: ruleState.allowedThicknesses,
    });

    if (filteredValues.length === thicknessCatalog.length) return thicknessCatalog;

    const allowedThicknessValues = new Set(filteredValues.map((value) => String(value)));
    return thicknessCatalog.filter((option) => allowedThicknessValues.has(option.value ?? option.title));
  }, [ruleState.allowedThicknesses, thicknessCatalog]);

  const filteredStyleOptions = useMemo(
    () =>
      styleCatalog.map((option) => {
        const style = option.name;
        const isIntegrated = style === "integrated";
        const styleState =
          style === "integrated" || style === "vessel" || style === "undermount"
            ? ruleState.styleAvailability[style]
            : null;
        const blockedByRules = styleState ? !styleState.isAvailable : false;
        const blockedByDepth = isDepth46VesselOnly && isIntegrated && styleState?.isAvailable !== true;
        const isAvailable = !(blockedByDepth || blockedByRules);

        return {
          ...option,
          isAvailable,
          disabledReason: blockedByDepth
            ? selectMessageOr(activeProfile, REASON_INTEGRATED_DEPTH_RESTRICTED, FALLBACK_INTEGRATED_DEPTH_RESTRICTED)
            : blockedByRules
              ? styleState?.disabledReason
              : undefined,
          disabledReasonCode: blockedByDepth
            ? REASON_INTEGRATED_DEPTH_RESTRICTED
            : blockedByRules
              ? styleState?.reasonCode
              : undefined,
          disabledReasonParams: blockedByDepth || !blockedByRules ? undefined : styleState?.reasonParams,
        };
      }),
    [activeProfile, isDepth46VesselOnly, ruleState.styleAvailability, styleCatalog],
  );
  const isActiveCountertopStyleAvailable = useMemo(() => {
    if (!countertopStyle) return false;

    return filteredStyleOptions.some((option) => {
      if (option.isAvailable === false) return false;
      return option.name === countertopStyle;
    });
  }, [countertopStyle, filteredStyleOptions]);
  const basinSelectionStyle = useMemo(() => {
    if (isActiveCountertopStyleAvailable) return countertopStyle;

    const firstAvailable = filteredStyleOptions.find((option) => option.isAvailable !== false);
    return firstAvailable?.name ?? "";
  }, [countertopStyle, filteredStyleOptions, isActiveCountertopStyleAvailable]);
  const isBasinSelectionVesselStyle = basinSelectionStyle === "vessel";
  const activeBasinOptionValue =
    isBasinSelectionVesselStyle && !activeBasinStyle ? VESSEL_SINK_NONE_OPTION_VALUE : activeBasinStyle;

  const allowedBasinTokens = useMemo(() => {
    return ruleState.allowedBasinTokens;
  }, [ruleState.allowedBasinTokens]);
  const allowedBasinKeys = useMemo(() => {
    return ruleState.allowedBasinKeys;
  }, [ruleState.allowedBasinKeys]);

  const filteredBasinOptions = useMemo<ProductOptionData[]>(() => {
    if (!basinCatalog.length) return [];

    const normalizedStyle = basinSelectionStyle;
    const allowedStyles = ruleState.allowedStyles;
    const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));
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

      const vesselOptions = basinCatalog.filter((option) => {
        const name = option.name ?? "";
        return isVisibleVesselSinkStyle(name, activeProfile);
      });
      const vesselSinkAvailability = ruleState.vesselSinkAvailability;
      const availabilityScopedVesselOptions = vesselOptions.map((option) => {
        if (vesselSinkAvailability.isAvailable) return option;

        return {
          ...option,
          isAvailable: false,
          disabledReason: vesselSinkAvailability.disabledReason,
          disabledReasonCode: vesselSinkAvailability.reasonCode,
          disabledReasonParams: vesselSinkAvailability.reasonParams,
        };
      });

      console.log("[BASIN/DEBUG][prebuilt][vessel]", {
        normalizedStyle,
        activeCountertopColor,
        activeThickness,
        activeBasinStyle,
        normalizedActiveMaterials,
        allowedStyles: Array.from(allowedStyles),
        vesselOptions: availabilityScopedVesselOptions.map((item) => item.name ?? item.title),
      });

      return [VESSEL_SINK_NONE_OPTION, ...availabilityScopedVesselOptions];
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
    const resolveBasinReason = (basinRules: typeof applicableIntegratedRules) =>
      resolveIntegratedBasinUnavailableReason({ basinRules, ...integratedWidthContext, profile: activeProfile });

    const integratedOptions = basinCatalog.flatMap((option) => {
      if (!integratedSinkNames.has(option.name ?? "")) return [];
      const label = option.title ?? option.name ?? "";
      if (!label) return [];

      const [, ...restTokens] = label.trim().split(/\s+/);
      const materialTokens = extractCountertopBasinMaterialScopeTokens(label, option.name);
      const isMaterialSpecific = materialTokens.some((token) =>
        getMaterialAliases(token, materialAliasTable).some((alias) => allowedMaterials.has(alias)),
      );

      if (isMaterialSpecific && normalizedActiveMaterials.length > 0) {
        const matchesMaterial = materialTokens.some((token) =>
          getMaterialAliases(token, materialAliasTable).some((alias) => normalizedActiveMaterials.includes(alias)),
        );
        if (!matchesMaterial) return [];
      }

      const basinLabelCandidates = isMaterialSpecific ? [restTokens.join(" "), label] : [label];
      const normalizedBasinLabelCandidates = new Set(
        basinLabelCandidates.map((candidate) => normalizeBasinKey(candidate)).filter(Boolean),
      );
      const basinRules = applicableIntegratedRules.filter((rule) =>
        normalizedBasinLabelCandidates.has(normalizeBasinKey(rule.basinStyle)),
      );
      if (!basinRules.length) return [];

      const isAvailable = basinRules.some((rule) =>
        isRuleWidthEligibleForIntegratedContext(rule, integratedWidthContext),
      );

      return [
        {
          ...option,
          isAvailable,
          disabledReason: isAvailable ? undefined : resolveBasinReason(basinRules).disabledReason,
          disabledReasonCode: isAvailable ? undefined : resolveBasinReason(basinRules).reasonCode,
          disabledReasonParams: isAvailable ? undefined : resolveBasinReason(basinRules).reasonParams,
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
    materialAliasTable,
    basinCatalog,
    activeCountertopColor,
    activeMaterialTokens,
    activeProfile,
    allowedBasinKeys,
    allowedBasinTokens,
    allowedMaterials,
    ruleState.allowedStyles,
    ruleState.matchingRules,
    ruleState.vesselSinkAvailability,
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
    () =>
      sortCountertopOptionsByAvailability(
        scopedCountertopOptions.map((option) => {
          const isAvailable = isMaterialOptionCompatibleBySceneSize(option);
          return {
            ...option,
            isAvailable,
            disabledReason: isAvailable ? undefined : getMaterialOptionDisabledReason(option),
        disabledReasonCode: isAvailable ? undefined : getMaterialOptionDisabledReasonCode(option),
          };
        }),
      ),
    [getMaterialOptionDisabledReason, getMaterialOptionDisabledReasonCode, isMaterialOptionCompatibleBySceneSize, scopedCountertopOptions],
  );
  const sortedVesselColorOptions = useMemo(
    () =>
      [...filteredVesselColorOptions].sort((a, b) => {
        const availabilityDiff = Number(a.isAvailable === false) - Number(b.isAvailable === false);
        if (availabilityDiff !== 0) return availabilityDiff;
        return (a.title ?? "").localeCompare(b.title ?? "");
      }),
    [filteredVesselColorOptions],
  );

  const getOptionConfigValue = useCallback((option: ProductOptionData): string => {
    return option.metadata?.value ?? option.name ?? option.title;
  }, []);

  const findVesselColorOptionByValue = useCallback(
    (colorName: string): ProductOptionData | undefined =>
      vesselColorOptions.find((option) => {
        const optionValue = getOptionConfigValue(option);
        return optionValue === colorName || option.title === colorName;
      }),
    [getOptionConfigValue, vesselColorOptions],
  );

  const resolveVesselColorForSinkStyle = useCallback(
    (vesselStyle: string): string => {
      const activeOption = activeVesselColor ? findVesselColorOptionByValue(activeVesselColor) : undefined;

      if (activeVesselColor && activeOption && isVesselColorCompatibleWithSinkStyle(activeOption, vesselStyle)) {
        return activeVesselColor;
      }

      const preferredOption = vesselColorOptions.find((option) => {
        if (!isVesselColorOption(option)) return false;
        if (!isVesselColorCompatibleWithSinkStyle(option, vesselStyle)) return false;
        return isPreferredVesselColorForSinkStyle(option, vesselStyle);
      });

      if (preferredOption) return getOptionConfigValue(preferredOption);

      const compatibleOption = vesselColorOptions.find((option) => {
        if (!isVesselColorOption(option)) return false;
        return isVesselColorCompatibleWithSinkStyle(option, vesselStyle);
      });

      if (compatibleOption) return getOptionConfigValue(compatibleOption);

      return activeOption ? "" : activeVesselColor;
    },
    [
      activeVesselColor,
      findVesselColorOptionByValue,
      getOptionConfigValue,
      isVesselColorCompatibleWithSinkStyle,
      isVesselColorOption,
      isPreferredVesselColorForSinkStyle,
      vesselColorOptions,
    ],
  );

  const syncVesselColorForSinkStyle = useCallback(
    async (vesselStyle: string) => {
      const nextVesselColor = resolveVesselColorForSinkStyle(vesselStyle);

      // Every sink base: the binding addresses them all, so the change names none.
      await changeAttributeValue({ attributeId: "VesselColor", value: nextVesselColor, scope: "basin" });
      setActiveVesselColor(nextVesselColor);

      if (nextVesselColor !== activeVesselColor) {
        setSelectedVesselFilter({});
      }
    },
    [activeVesselColor, changeAttributeValue, resolveVesselColorForSinkStyle],
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

  const handleChangeCountertopColor = async (
    colorName: string,
    _config?: unknown,
    metadata?: ProductOptionMetadata,
  ) => {
    if (!colorName) return;

    const selectedOption = scopedCountertopOptions.find((option) => {
      const optionValue = option.metadata?.value ?? option.name ?? option.title;
      return optionValue === colorName || option.title === colorName;
    });
    if (selectedOption && !evaluateMaterialOptionCompatibility(selectedOption).isCompatible) {
      return;
    }

    await saveSnapshot();

    const result = await changeAttributeValue({
      attributeId: "CountertopColor",
      value: colorName,
      scope: "countertop",
    });
    if (result.status !== "applied") return;
    dispatch(setCountertopColorSku(metadata?.sku ?? findSkuByColorName(colorName)));
  };

  const handleChangeVesselColor = async (colorName: string) => {
    if (!colorName) return;
    const selectedOption = findVesselColorOptionByValue(colorName);
    if (selectedOption && !isVesselColorCompatibleWithSinkStyle(selectedOption)) return;

    await saveSnapshot();

    if (!sinkBaseCabinetId) return;
    const result = await changeAttributeValue({
      attributeId: "VesselColor",
      value: colorName,
      scope: "basin",
      sinkBaseId: sinkBaseCabinetId,
    });
    if (result.status !== "applied") return;

    setActiveVesselColor(colorName);
  };

  const applyBasinStyleByDependencies = useCallback(
    async (basinStyle: string, selectedOnlyProductId?: string | null) => {
      if (!basinStyle) return;

      const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));
      const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
      const selectedDepth = selectedDimensions.depth ?? null;
      const basinOption = basinCatalog.find((option) => (option.name ?? option.title) === basinStyle);
      const basinLabel = basinOption?.title ?? basinOption?.name ?? basinStyle;
      const basinKey = normalizeBasinKey(basinLabel);

      const applicableRules = countertopRules.filter((rule) => {
        if (!matchesDepthForStyle(rule, selectedDepth, "integrated")) return false;

        if (activeThicknessValue !== null) {
          const matchesThickness = rule.topThicknesses
            .map((value) => parseThicknessValue(value))
            .filter((value): value is number => value !== null)
            .some((value) => Math.abs(value - activeThicknessValue) < 0.001);
          if (!matchesThickness) return false;
        }

        if (!normalizedActiveMaterials.length) return true;
        return normalizedActiveMaterials.some((material) => materialMatchesRule(material, rule.material, materialAliasTable));
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
          recordedDimensions: resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, productId),
        });
        return canUseBasinAtWidth(normalizedConfig.Width);
      });
      const finalTargetIds = selectedOnlyProductId
        ? targetIds.filter((productId) => productId === selectedOnlyProductId)
        : targetIds;

      if (!finalTargetIds.length) return;

      // One command per fitting sink base. The basin binding addresses every Sink-Base, so the
      // sink base a change names is what keeps the others on the basin they already have.
      for (const productId of finalTargetIds) {
        const sinkBaseId = resolveStableKey(cabinetEntries, productId);
        if (!sinkBaseId) continue;

        await changeAttributeValue({ attributeId: "sinkType", value: basinStyle, scope: "basin", sinkBaseId });
      }
    },
    [
      materialAliasTable,
      basinCatalog,
      activeMaterialTokens,
      activeThickness,
      countertopRules,
      selectedProducts,
      containsSinkBase,
      changeAttributeValue,
      sceneTotalWidth,
      selectedDimensions,
      cabinetEntries,
      dimensionsByCabinet,
    ],
  );

  /**
   * The vessel cutout: the scene keeps a token where state keeps "no basin chosen".
   * The token is the profile's noneValue for sinkType, so the page does not spell it out.
   */
  const applyVesselCutout = useCallback(async () => {
    const noneValue = selectAttribute(activeProfile, "sinkType")?.noneValue;
    if (!noneValue || !sinkBaseCabinetId) return false;

    const result = await changeAttributeValue({
      attributeId: "sinkType",
      value: noneValue,
      scope: "basin",
      sinkBaseId: sinkBaseCabinetId,
    });

    return result.status === "applied";
  }, [activeProfile, changeAttributeValue, sinkBaseCabinetId]);

  const handleAddBasinStyle = async (basinStyle: string) => {
    const selectedOption = filteredBasinOptions.find((option) => (option.name ?? option.title) === basinStyle);
    if (selectedOption?.isAvailable === false) return;

    await saveSnapshot();
    if (basinStyle === VESSEL_SINK_NONE_OPTION_VALUE) {
      if (!isVesselStyle) {
        await changeAttributeValue({ attributeId: "CountertopStyle", value: "vessel", scope: "countertop" });
      }
      await applyVesselCutout();
      return;
    }
    if (basinStyle.startsWith("Vessel_")) {
      if (!isVesselStyle) {
        await changeAttributeValue({ attributeId: "CountertopStyle", value: "vessel", scope: "countertop" });
      }
      // Toggle: clicking the already-selected vessel reverts to empty cutout
      if (activeBasinStyle === basinStyle) {
        await applyVesselCutout();
        return;
      }
      await changeAttributeValue({ attributeId: "sinkType", value: basinStyle, scope: "basin" });
      await syncVesselColorForSinkStyle(basinStyle);
      return;
    }
    await applyBasinStyleByDependencies(basinStyle);
  };

  const applyBasinStyleFallback = useCallback(
    async (basinStyle: string) => {
      if (!basinStyle) return;
      if (basinStyle.startsWith("Vessel_")) {
        await changeAttributeValue({ attributeId: "sinkType", value: basinStyle, scope: "basin" });
        await syncVesselColorForSinkStyle(basinStyle);
        return;
      }
      await applyBasinStyleByDependencies(basinStyle);
    },
    [applyBasinStyleByDependencies, changeAttributeValue, syncVesselColorForSinkStyle],
  );

  const handleAddThickness = useCallback(
    async (thickness: string) => {
      await saveSnapshot();

      const result = await changeAttributeValue({ attributeId: "Thickness", value: thickness, scope: "countertop" });
      if (result.status !== "applied") return;
    },
    [changeAttributeValue, saveSnapshot],
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
    const defaultBasin = resolveDefaultBasinForCountertopSelection({
      countertopColor: activeCountertopColor,
      materialTokens: activeMaterialTokens,
    });
    const hasDefaultBasin =
      defaultBasin !== null && availableBasinOptions.some((option) => (option.name ?? option.title) === defaultBasin);
    const currentBasinMaterialTokens = new Set(getCountertopMaterialTokensFromBasinType(activeBasinStyle));
    const defaultBasinMaterialTokens = getCountertopMaterialTokensFromBasinType(defaultBasin);
    const isSameBasinMaterialFamily =
      defaultBasinMaterialTokens.length > 0 &&
      defaultBasinMaterialTokens.some((token) => currentBasinMaterialTokens.has(token));

    if (
      hasDefaultBasin &&
      (activeBasinStyle === "Top_HPLPrisma" || !activeBasinStyle || !currentStillValid || !isSameBasinMaterialFamily)
    ) {
      applyBasinStyleFallback(defaultBasin);
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
    activeMaterialTokens,
  ]);

  useEffect(() => {
    if (!isVesselStyle) return;
    if (ruleState.vesselSinkAvailability.isAvailable) return;
    if (!activeBasinStyle.startsWith("Vessel_")) return;

    // Back to the plain cutout: the scene keeps the profile's noneValue, state keeps no basin.
    const noneValue = selectAttribute(activeProfile, "sinkType")?.noneValue;
    if (noneValue) void changeAttributeValue({ attributeId: "sinkType", value: noneValue, scope: "basin" });
  }, [
    activeBasinStyle,
    activeProfile,
    changeAttributeValue,
    isVesselStyle,
    ruleState.vesselSinkAvailability.isAvailable,
  ]);

  const handleCountertopStyle = async (style: string) => {
    if (!style) return;
    await saveSnapshot();
    const styleResult = await changeAttributeValue({ attributeId: "CountertopStyle", value: style, scope: "countertop" });
    if (styleResult.status !== "applied") return;

    if (style.toLowerCase() === "vessel") {
      // Show hole cutout on countertop without any vessel model: the profile's noneValue,
      // which the binding sends to Sink-Base cabinets only (not OS/SC).
      const noneValue = selectAttribute(activeProfile, "sinkType")?.noneValue;
      if (noneValue) await changeAttributeValue({ attributeId: "sinkType", value: noneValue, scope: "basin" });
    } else {
      // Leaving vessel style — reset VesselColor so it doesn't persist
      await changeAttributeValue({ attributeId: "VesselColor", value: "", scope: "basin" });
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

  const handleOrderCountertopSwatches = () => {
    trackModularOrderFreeSwatchesClick({
      cta_location: "countertop_color",
      configurator_flow: "prebuilt",
      product_element: "Countertop Color",
    });
    dispatch(openSwatchOrder("Countertop Color"));
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "countertop-color",
      title: "Countertop Color",
      defaultOpen: true,
      content: (
        <>
          <ViewModePanel
            onOrderSwatches={handleOrderCountertopSwatches}
            fullModeTitle="Countertop Color"
            fullModeOptions={fullModeCountertopOptions}
            fullModeActiveValue={activeCountertopColor}
            onFullModeSelect={handleChangeCountertopColor}
            fullModeGroupByDesc
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
          activeValue={countertopStyle}
        />
      ),
    },
    {
      id: "basin-style",
      title: isBasinSelectionVesselStyle ? "Vessel Sink Style" : "Basin style",
      content: !hasSelectedMaterial ? (
        <div>Select a material first to enable basin styles.</div>
      ) : !activeThickness ? (
        <div>Select a thickness first to enable basin styles.</div>
      ) : isSinkDisabled ? (
        <div>Select a cabinet type with sink support to enable basin styles.</div>
      ) : filteredBasinOptions.length === 0 && isBasinSelectionVesselStyle ? (
        <div>No vessel sink styles available for the selected material.</div>
      ) : (
        <ProductOptionsGrid
          handleAdd={handleAddBasinStyle}
          data={filteredBasinOptions}
          activeValue={activeBasinOptionValue}
        />
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
  const isCompactAccordionViewport = useCompactAccordionViewport();
  const { value: accordionValue, onValueChange: setAccordionValue } = useSyncedAccordionValue({
    values: accordionValues,
    defaultValue,
    requestedValue: searchParams.get("accordion"),
    requestKey: locationKey,
    collapseByDefault: isCompactAccordionViewport && ACCORDIONS.length > 1,
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
