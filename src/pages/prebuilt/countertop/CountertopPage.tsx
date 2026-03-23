import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopStyle,
  getProductsPresets,
  getSelectedSceneProduct,
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
} from "@/entities/product/model/store/slice.ts";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux.ts";
import {
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import { useGetConfiguratorQuery } from "@/entities";
import {
  buildCountertopRuleState,
  getMaterialAliases,
  materialMatchesRule,
  matchesDepth,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
  parseCountertopMatrix,
} from "@/features/configurator-rule-core/countertop";

import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch.ts";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";
import { vesselAllowedMaterialsMap, extractColorCode } from "@/shared/lib/sku";

import s from "./CountertopPage.module.scss";
import { BaseButton } from "@/shared";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";

const COUNTERTOP_OPTION = "Counertops materials";
const MATERIAL_FILTER_DISABLED_REASON = "Not available for current cabinet size on scene";

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
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const hasSelectedMaterial = Boolean(activeCountertopColor);
  const isVesselStyle = (activeCountertopStyle ?? "").trim().toLowerCase() === "vessel";
  const [hasSinkBase, setHasSinkBase] = useState(false);
  const isSinkDisabled = !hasSinkBase;

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const defaultMaterialFilters = useMemo(() => buildMaterialFilters(COUNTERTOP_OPTION), []);

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
            const metaHex = meta.hex;
            const descSource = option.name || group.proxyName || variant.name;

            const isCemento = variant.name.toLowerCase().startsWith("cemento");

            return [
              {
                id: variant.id,
                title: meta.label ?? variant.name,
                name: variant.name,
                desc: normalizeMaterialLabel(descSource),
                isShortDesc: false,
                metadata: {
                  image: meta.image,
                  value: meta.value ?? variant.name,
                  sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                  materials: buildMaterialTokens(option.name || variant.name, metaMaterial, [
                    ...(group.proxyName ? [group.proxyName] : []),
                    ...(isCemento ? ["Cemento"] : []),
                  ]),
                  colors: toStringArrayFromCsv(metaColor),
                  looks: toStringArrayFromCsv(metaLook),
                  hex: metaHex?.trim(),
                },
              },
            ];
          }),
      ),
    );
  }, [counterTopMaterials, getVariantMeta]);

  const countertopOptions = useMemo(() => countertopOptionsFromApi, [countertopOptionsFromApi]);

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

  const countertopRules = useMemo(() => parseCountertopMatrix(counterTopData), [counterTopData]);

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
            .map((value) => normalizeMaterialAlias(value)) as string[];

          const matchesMatrix =
            normalizedMatrixMaterials.size === 0 ||
            candidateMaterials.some((value) =>
              getMaterialAliases(value).some((alias) => normalizedMatrixMaterials.has(alias)),
            );

          if (!matchesMatrix) return;

          if (option.name) materialSet.add(normalizeMaterialAlias(option.name));

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
    if (!activeCountertopColor) return [];
    const match = countertopOptions.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      return candidate === activeCountertopColor;
    });
    return match?.metadata?.materials ?? [];
  }, [activeCountertopColor, countertopOptions]);

  const ruleState = useMemo(
    () =>
      buildCountertopRuleState({
        rules: countertopRules,
        activeMaterialTokens,
        width: selectedDimensions.width,
        depth: selectedDimensions.depth,
        activeBasinStyle,
        activeThickness,
      }),
    [
      activeBasinStyle,
      activeMaterialTokens,
      activeThickness,
      countertopRules,
      selectedDimensions.depth,
      selectedDimensions.width,
    ],
  );

  const allowedMaterials = ruleState.allowedMaterials;

  const scopedCountertopOptions = useMemo(
    () =>
      countertopOptions.filter((option) => {
        const hasVesselsToken = (option.metadata?.materials ?? []).some(
          (material) => normalizeMaterialToken(material) === "vessels",
        );
        if (!isVesselStyle) return !hasVesselsToken;

        const hasIntegratedCompatibleMaterial = (option.metadata?.materials ?? []).some((material) => {
          const aliases = getMaterialAliases(material);
          return aliases.some(
            (alias) =>
              alias === "fenix" || alias === "fx" || alias === "hpl" || alias === "porcelain" || alias === "por",
          );
        });

        return hasVesselsToken || hasIntegratedCompatibleMaterial;
      }),
    [countertopOptions, isVesselStyle],
  );

  const styleScopedFilters = useMemo(() => {
    if (!scopedCountertopOptions.length) return defaultMaterialFilters;

    const materialSet = new Set<string>();
    const colorSet = new Set<string>();
    const lookSet = new Set<string>();
    const hexSet = new Set<string>();

    scopedCountertopOptions.forEach((option) => {
      if (isVesselStyle) {
        const vesselMaterial = (option.desc ?? "").trim();
        if (vesselMaterial) {
          materialSet.add(normalizeMaterialAlias(vesselMaterial));
        }
        materialSet.add("Fenix");
        materialSet.add("HPL");
        materialSet.add("Porcelain");
      } else {
        (option.metadata?.materials ?? []).forEach((material) => {
          if (normalizeMaterialToken(material) === "vessels") return;
          materialSet.add(normalizeMaterialAlias(material));
        });
      }

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
  }, [defaultMaterialFilters, isVesselStyle, scopedCountertopOptions]);

  const displayedMaterialFilters = isVesselStyle ? styleScopedFilters : materialFilters;

  const filteredMaterialFilters = useMemo(
    () => ({ ...displayedMaterialFilters, materials: groupMaterialsHierarchically(displayedMaterialFilters.materials) }),
    [displayedMaterialFilters],
  );

  const tierOptions = useMemo(() => buildTierFilterOptions(scopedCountertopOptions), [scopedCountertopOptions]);

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

  const isMaterialOptionCompatibleBySceneSize = useCallback(
    (option: (typeof scopedCountertopOptions)[number]) => {
      const optionMaterials = option.metadata?.materials ?? [];
      if (!optionMaterials.length) return true;

      const selectedDepth = selectedDimensions.depth ?? null;
      const selectedWidth = selectedDimensions.width ?? null;

      const applicableRules = countertopRules.filter((rule) => {
        if (!matchesDepth(rule, selectedDepth)) return false;

        return optionMaterials.some((material) => materialMatchesRule(material, rule.material));
      });

      if (!applicableRules.length) {
        const hasCeramicMaterial = optionMaterials.some((material) => normalizeMaterialToken(material) === "ceramic");
        return hasCeramicMaterial;
      }

      if (!selectedWidth) return true;

      return applicableRules.some((rule) => {
        if (rule.minSbCm && selectedWidth < rule.minSbCm) return false;

        const maxLimits = [rule.maxIntegratedCm, rule.maxVesselCm, rule.maxUndermountCm].filter(
          (value): value is number => value !== null,
        );
        if (maxLimits.length > 0 && !maxLimits.some((limit) => selectedWidth <= limit)) return false;

        if (
          rule.integratedAllowedSizesOnly.length > 0 &&
          !rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - selectedWidth) < 0.01)
        ) {
          return false;
        }

        return true;
      });
    },
    [countertopRules, selectedDimensions.depth, selectedDimensions.width],
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

  const materialFilterOptions = useMemo(() => {
    const annotate = (option: MaterialFilterOption): MaterialFilterOption => {
      if (option.children?.length) {
        const children = option.children.map((child) => annotate(child));
        const isDisabled = children.every((child) => child.disabled);
        return {
          ...option,
          children,
          disabled: isDisabled,
          reason: isDisabled ? MATERIAL_FILTER_DISABLED_REASON : undefined,
        };
      }

      const isAvailable = hasAnyCompatibleOptionForMaterialFilter(option.value);
      return {
        ...option,
        disabled: !isAvailable,
        reason: !isAvailable ? MATERIAL_FILTER_DISABLED_REASON : undefined,
      };
    };

    return (filteredMaterialFilters.materials as MaterialFilterOption[]).map((option) => annotate(option));
  }, [filteredMaterialFilters.materials, hasAnyCompatibleOptionForMaterialFilter]);

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
        disabledReason: isAvailable
          ? undefined
          : "Not available for current cabinet width/depth/thickness on scene",
      };
    });
  }, [
    isMaterialOptionCompatibleBySceneSize,
    materialsMatchSelection,
    scopedCountertopOptions,
    selectedFilter,
    selectedMaterialValues,
  ]);

  const filteredThicknessOptions = useMemo(() => {
    const allowed = ruleState.allowedThicknesses;
    if (!allowed.size) return optionsMockData4;

    return optionsMockData4.filter((option) => {
      const rawValue = option.value ?? option.title;
      const numeric = Number.parseFloat(rawValue);
      if (!Number.isFinite(numeric)) return false;
      return Array.from(allowed).some((value) => Math.abs(value - numeric) < 0.001);
    });
  }, [ruleState.allowedThicknesses]);

  const allowedBasinTokens = useMemo(() => {
    return ruleState.allowedBasinTokens;
  }, [ruleState.allowedBasinTokens]);
  const allowedBasinKeys = useMemo(() => {
    return ruleState.allowedBasinKeys;
  }, [ruleState.allowedBasinKeys]);

  const filteredBasinOptions = useMemo(() => {
    if (!optionsMockData3.length) return [];

    const normalizedStyle = activeCountertopStyle ? activeCountertopStyle.trim().toLowerCase() : "";
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

    const vesselSinkNames = new Set(["Vessel_Blade11", "Vessel_Blade18", "Vessel_UrbanModo", "Vessel_UrbanMorris"]);

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
      "Top_Syntesi",
      "Top_Tekorlux_Quadra",
      "Top_Tekorlux_Rectangular",
      "Top_Tekorlux_Ron",
      "Top_Tekorlux_Trip",
      "Top_Tekormud_Tivi",
    ]);

    if (normalizedStyle === "vessel") {
      if (allowedStyles.size && !allowedStyles.has("vessel")) return [];

      const activeColorCode = activeCountertopColor
        ? normalizeMaterialToken(extractColorCode(activeCountertopColor) ?? "")
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

    if (!allowedBasinKeys.size) {
      console.log("[BASIN/DEBUG][prebuilt][integrated-empty]", {
        normalizedStyle,
        activeCountertopColor,
        activeThickness,
        activeBasinStyle,
        normalizedActiveMaterials,
        allowedMaterials: Array.from(allowedMaterials),
        allowedBasinTokens: Array.from(allowedBasinTokens),
        allowedBasinKeys: Array.from(allowedBasinKeys),
        allowedStyles: Array.from(allowedStyles),
      });
      return [];
    }

    const integratedOptions = optionsMockData3.filter((option) => {
      if (!integratedSinkNames.has(option.name ?? "")) return false;
      const label = option.title ?? option.name ?? "";
      if (!label) return false;

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
        if (!matchesMaterial) return false;
      }

      const basinLabel = isMaterialSpecific ? restTokens.join(" ") : label;
      const normalized = normalizeBasinKey(basinLabel);

      return Array.from(allowedBasinKeys).some((token) => normalized === token);
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
      integratedOptions: integratedOptions.map((item) => item.name ?? item.title),
    });

    return integratedOptions;
  }, [
    activeCountertopColor,
    activeCountertopStyle,
    activeMaterialTokens,
    allowedBasinKeys,
    allowedBasinTokens,
    allowedMaterials,
    ruleState.allowedStyles,
    activeBasinStyle,
    activeThickness,
  ]);

  const filteredStyleOptions = useMemo(
    () =>
      optionsMockData2.map((option) => ({
        ...option,
        isAvailable: true,
        disabledReason: undefined,
      })),
    [],
  );

  const sortedCountertopOptions = useMemo(
    () => [...filteredCountertopOptions].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    [filteredCountertopOptions],
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

  const handleChangeCountertopColor = async (colorName: string) => {
    if (!colorName) return;
    await saveSnapshot();

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { CountertopColor: colorName });
    });

    dispatch(setActiveCountertopColor(colorName));
    dispatch(setCountertopColorSku(findSkuByColorName(colorName)));
  };

  const applyBasinStyleByDependencies = useCallback(
    async (basinStyle: string, selectedOnlyProductId?: string | null) => {
      if (!basinStyle) return;

      const extractWidth = (config: Record<string, unknown>): number | null => {
        const raw = config.Width;
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        if (typeof raw === "string") {
          const parsed = Number(raw.replace(",", "."));
          return Number.isFinite(parsed) ? parsed : null;
        }
        if (raw && typeof raw === "object") {
          const key = Object.keys(raw as Record<string, unknown>)[0];
          if (key) {
            const parsed = Number(key.replace(",", "."));
            return Number.isFinite(parsed) ? parsed : null;
          }
        }
        return null;
      };

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

        return basinRules.some((rule) => {
          if (rule.minSbCm && width < rule.minSbCm) return false;
          if (rule.maxIntegratedCm && width > rule.maxIntegratedCm) return false;
          if (
            rule.integratedAllowedSizesOnly.length > 0 &&
            !rule.integratedAllowedSizesOnly.some((value) => Math.abs(value - width) < 0.01)
          ) {
            return false;
          }
          return true;
        });
      };

      const orderedIds = getOrderedProductIds(selectedProducts);
      if (!orderedIds.length) return;

      const configs = await Promise.all(orderedIds.map((id) => getConfig(id)));
      const targetIds = orderedIds.filter((_, index) => {
        const rawConfig = configs[index];
        if (!rawConfig || typeof rawConfig !== "object") return false;
        const config = rawConfig as Record<string, unknown>;
        if (!containsSinkBase(config)) return false;
        return canUseBasinAtWidth(extractWidth(config));
      });
      const finalTargetIds = selectedOnlyProductId
        ? targetIds.filter((productId) => productId === selectedOnlyProductId)
        : targetIds;

      if (finalTargetIds.length > 0) {
        await setConfigBatch(finalTargetIds, { sinkType: basinStyle });
      }

      dispatch(setActiveBasinStyle(basinStyle));
    },
    [
      activeMaterialTokens,
      activeThickness,
      selectedDimensions.depth,
      countertopRules,
      selectedProducts,
      containsSinkBase,
      dispatch,
    ],
  );

  const handleAddBasinStyle = async (basinStyle: string) => {
    await saveSnapshot();
    if (basinStyle.startsWith("Vessel_")) {
      presetNames.forEach((productName) => {
        setConfigBatch({ productType: productName }, { sinkType: basinStyle });
      });
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
      await applyBasinStyleByDependencies(basinStyle, selectedSceneProduct);
    },
    [applyBasinStyleByDependencies, dispatch, presetNames, selectedSceneProduct],
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
    if (!filteredBasinOptions.length) return;

    const currentStillValid =
      activeBasinStyle && filteredBasinOptions.some((option) => (option.name ?? option.title) === activeBasinStyle);

    if (!currentStillValid) {
      const first = filteredBasinOptions[0];
      const basinValue = first?.name ?? first?.title;
      if (basinValue) {
        applyBasinStyleFallback(basinValue);
      }
    }
  }, [
    activeBasinStyle,
    activeThickness,
    applyBasinStyleFallback,
    filteredBasinOptions,
    hasSelectedMaterial,
    isSinkDisabled,
  ]);

  const handleCountertopStyle = (style: string) => {
    if (!style) return;
    dispatch(setCountertopStyle(style));
  };

  const clearAllFilters = () => {
    setSelectedFilter({});
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

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "countertop-color",
      title: isVesselStyle ? "Vessel Color" : "Countertop Color",
      defaultOpen: true,
      content: (
        <>
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
      title: "Basin style",
      content: !hasSelectedMaterial ? (
        <div>Select a material first to enable basin styles.</div>
      ) : !activeThickness ? (
        <div>Select a thickness first to enable basin styles.</div>
      ) : isSinkDisabled ? (
        <div>Select a cabinet type with sink support to enable basin styles.</div>
      ) : (
        <ProductOptionsGrid handleAdd={handleAddBasinStyle} data={filteredBasinOptions} />
      ),
    },
  ];

  const defaultValue = ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString();
  const [accordionValue, setAccordionValue] = useState(defaultValue);

  useEffect(() => {
    const target = searchParams.get("accordion");
    if (target) setAccordionValue(target);
  }, [searchParams]);

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
