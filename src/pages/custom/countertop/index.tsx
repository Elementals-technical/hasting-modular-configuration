import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import {
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
  groupMaterialsHierarchically,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopStyle,
  getSelectedProducts,
  getSelectedDimensions,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import {
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setCountertopStyle,
  setCountertopColorSku,
} from "@/entities/product/model/store/slice";
import { vesselAllowedMaterialsMap, extractColorCode } from "@/shared/lib/sku";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import {
  buildCountertopRuleState,
  getMaterialAliases,
  normalizeBasinKey,
  normalizeMaterialToken,
  parseThicknessValue,
  parseCountertopMatrix,
} from "@/features/configurator-rule-core/countertop";

import s from "./Countertop.module.scss";
import { useGetConfiguratorQuery } from "@/entities";
import { BaseButton } from "@/shared";
import { buildTierFilterOptions, filterOptionsByTier } from "@/shared/constants/priceFilters";

const COUNTERTOP_OPTION = "Counertops materials";

export const CustomCountertopPage = () => {
  const [searchParams] = useSearchParams();

  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const [hasSinkBase, setHasSinkBase] = useState(false);
  const isSinkDisabled = !hasSinkBase;

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const defaultMaterialFilters = useMemo(() => buildMaterialFilters(COUNTERTOP_OPTION), []);
  const hasSelectedMaterial = Boolean(activeCountertopColor);

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);

  const { data: counterTopMaterials, isFetching: isFetchingcounterTopMaterials } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  console.log("materials", counterTopMaterials);

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

  const getVariantMeta = useCallback(
    (variant: { metadata?: Record<string, unknown>; name: string; image?: string | null }) => {
      const meta = (variant.metadata ?? {}) as Record<string, unknown>;
      const nested =
        typeof meta.metadata === "object" && meta.metadata
          ? (meta.metadata as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const pick = (...values: unknown[]): string | undefined => {
        for (const value of values) {
          const str = toOptionalString(value);
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

  const toStringArrayFromCsv = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  };

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
            const dedupeKey = `${normalizedMaterialName}::${normalizedName}`;
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

  console.log("countertopOptionsFromApi", countertopOptionsFromApi);

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
        mineralmarmo: "SSMLM",
        minermalmaro: "SSMLM",
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

  console.log("countertopOptions", countertopOptions);

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

  const activeMaterialTokens = useMemo(() => {
    if (!activeCountertopColor) return [];
    const match = countertopOptions.find((option) => {
      const candidate = option.metadata?.value ?? option.name ?? option.title ?? option.desc;
      return candidate === activeCountertopColor;
    });
    return match?.metadata?.materials ?? [];
  }, [activeCountertopColor, countertopOptions]);

  console.log("activeMaterialTokens", activeMaterialTokens);

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

  const materialFilters = useMemo(() => {
    const groups = (counterTopMaterials?.availableOptions ?? []).filter(
      (g) => g.proxyName === "Countertop Color" || g.proxyName === "Vessels",
    );
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

          if (group.proxyName === "Vessels") {
            materialSet.add(option.name);
            return;
          }

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
  }, [counterTopMaterials, defaultMaterialFilters, matrixMaterials, normalizedMatrixMaterials, getVariantMeta]);

  const hasApiOptions = countertopOptionsFromApi.length > 0;
  const hasAllowedOptionMatch = useMemo(() => {
    if (!allowedMaterials.size) return true;
    if (!hasApiOptions) return true;

    return countertopOptionsFromApi.some((option) => {
      const materials = option.metadata?.materials ?? [];
      return materials.some((material) => getMaterialAliases(material).some((alias) => allowedMaterials.has(alias)));
    });
  }, [allowedMaterials, countertopOptionsFromApi, hasApiOptions]);

  const filteredMaterialFilters = useMemo(
    () => ({ ...materialFilters, materials: groupMaterialsHierarchically(materialFilters.materials) }),
    [materialFilters],
  );

  const tierOptions = useMemo(() => buildTierFilterOptions(countertopOptions), [countertopOptions]);

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

  const filteredCountertopOptions = useMemo(() => {
    const filteredByUiBase = filterOptionsByMaterialSelection(countertopOptions, {
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

    const filteredByMaterial =
      !allowedMaterials.size || (hasApiOptions && !hasAllowedOptionMatch)
        ? filteredByUi
        : filteredByUi.filter((option) => {
            const materials = option.metadata?.materials ?? [];
            if (materials.some((m) => m.toLowerCase() === "vessels")) return true;
            const isGlassOption = materials.some((material) =>
              getMaterialAliases(material).some((alias) => alias === "glass" || alias === "glassmt" || alias === "glassgl"),
            );
            if (isGlassOption) return true;
            return materials.some((material) =>
              getMaterialAliases(material).some((alias) => allowedMaterials.has(alias)),
            );
          });

    return filterOptionsByTier(filteredByMaterial, selectedFilter.tier);
  }, [
    allowedMaterials,
    countertopOptions,
    hasAllowedOptionMatch,
    hasApiOptions,
    materialsMatchSelection,
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
    console.log("[BASIN/DEBUG][custom][start]", {
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

      console.log("[BASIN/DEBUG][custom][vessel]", {
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
      console.log("[BASIN/DEBUG][custom][integrated-empty]", {
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

    console.log("[BASIN/DEBUG][custom][integrated]", {
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

  const filteredStyleOptions = useMemo(() => {
    const allowed = ruleState.allowedStyles;
    const width = selectedDimensions.width;
    const depth = selectedDimensions.depth;
    const activeThicknessValue = activeThickness ? parseThicknessValue(activeThickness) : null;
    const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));
    const activeColorCode = activeCountertopColor
      ? normalizeMaterialToken(extractColorCode(activeCountertopColor) ?? "")
      : null;
    const isGlassSelected = normalizedActiveMaterials.some((token) =>
      getMaterialAliases(token).some((alias) => alias === "glass" || alias === "glassmt" || alias === "glassgl"),
    );

    const vesselSinkNames = ["Vessel_Blade11", "Vessel_Blade18", "Vessel_UrbanModo", "Vessel_UrbanMorris"];
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
    const hasVesselByDedicatedRules =
      hasSelectedMaterial &&
      vesselSinkNames.some((name) => {
        const allowedMats = vesselAllowedMaterialsMap[name];
        if (allowedMats === null || allowedMats === undefined) return true;
        return allowedMats.some((mat) => normalizedActiveMaterials.includes(mat) || mat === activeColorCode);
      });
    const hasVesselBasinOptions =
      hasSelectedMaterial &&
      optionsMockData3.some((option) => {
        const name = option.name ?? "";
        if (!vesselSinkNames.includes(name)) return false;
        const allowedMats = vesselAllowedMaterialsMap[name];
        if (allowedMats === null || allowedMats === undefined) return true;
        return allowedMats.some((mat) => normalizedActiveMaterials.includes(mat) || mat === activeColorCode);
      });
    const hasIntegratedBasinOptions =
      hasSelectedMaterial &&
      allowedBasinKeys.size > 0 &&
      optionsMockData3.some((option) => {
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

    const rulesForThickness = ruleState.matchingRules.filter((rule) => {
      if (activeThicknessValue === null) return true;
      const values = rule.topThicknesses
        .map((value) => parseThicknessValue(value))
        .filter((value): value is number => value !== null);
      return values.some((value) => Math.abs(value - activeThicknessValue) < 0.001);
    });

    const minSbRequirement = rulesForThickness
      .map((rule) => rule.minSbCm)
      .filter((value): value is number => value !== null)
      .reduce<number | null>((min, value) => (min === null ? value : Math.min(min, value)), null);

    const maxIntegratedLimit = rulesForThickness
      .map((rule) => rule.maxIntegratedCm)
      .filter((value): value is number => value !== null)
      .reduce<number | null>((max, value) => (max === null ? value : Math.max(max, value)), null);

    const maxVesselLimit = rulesForThickness
      .map((rule) => rule.maxVesselCm)
      .filter((value): value is number => value !== null)
      .reduce<number | null>((max, value) => (max === null ? value : Math.max(max, value)), null);

    const buildDisabledReason = (styleKey: string): string => {
      if (!hasSelectedMaterial) return "Select countertop color first.";
      if (!activeThickness) return "Select thickness first.";

      if (styleKey === "integrated") {
        if (isGlassSelected) {
          const hints: string[] = [];
          if (activeThicknessValue === null || Math.abs(activeThicknessValue - 0.5) > 0.001) {
            hints.push('set Thickness to 1/2".');
          }
          if (typeof depth !== "number" || Math.abs(depth - 50.5) > 0.01) {
            hints.push("set Depth to 50.5 cm.");
          }
          if (typeof width === "number" && width < 70) {
            hints.push("set Sink Base width to at least 70 cm.");
          }
          if (hints.length > 0) {
            return `For Glass Integrated, ${hints.join(" ")}`;
          }
        }
        if (!hasIntegratedBasinOptions) {
          return "No Integrated basin options for current material.";
        }
        if (!rulesForThickness.length) return "No rule for selected thickness/depth.";
        if (width && minSbRequirement !== null && width < minSbRequirement) {
          return `Requires cabinet width at least ${minSbRequirement} cm.`;
        }
        if (width && maxIntegratedLimit !== null && width > maxIntegratedLimit) {
          return `Integrated is available up to ${maxIntegratedLimit} cm.`;
        }
        return "Integrated is not available for current basin/material.";
      }

      if (styleKey === "vessel") {
        if (isGlassSelected) {
          return "Vessel is unavailable for Glass. Change countertop material to HPL, Porcelain, Solid Surface, or Tekorlux TAL/TAM.";
        }
        if (!hasVesselBasinOptions) {
          return "No Vessel basin options for current material.";
        }
        if (!rulesForThickness.length) return "No rule for selected thickness/depth.";
        if (width && maxVesselLimit !== null && width > maxVesselLimit) {
          return `Vessel is available up to ${maxVesselLimit} cm.`;
        }
        return "Vessel is not available for current material/thickness.";
      }

      if (!rulesForThickness.length) return "No rule for selected thickness/depth.";
      return "Not available for current configuration.";
    };

    return optionsMockData2.map((option) => {
      const styleKey = option.title.toLowerCase();
      const isAvailable =
        styleKey === "vessel"
          ? (allowed.has(styleKey) || hasVesselByDedicatedRules) && hasVesselBasinOptions
          : allowed.has(styleKey);
      return {
        ...option,
        isAvailable,
        disabledReason: isAvailable ? undefined : buildDisabledReason(styleKey),
      };
    });
  }, [
    activeCountertopColor,
    activeMaterialTokens,
    activeThickness,
    allowedBasinKeys,
    allowedMaterials,
    hasSelectedMaterial,
    ruleState.allowedStyles,
    ruleState.matchingRules,
    selectedDimensions.depth,
    selectedDimensions.width,
  ]);

  const sortedCountertopOptions = useMemo(
    () => [...filteredCountertopOptions].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    [filteredCountertopOptions],
  );

  // Check whether we have the product with the Sink on the scene.
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

  const handleChangeCountertopColor = async (colorName: string) => {
    if (!colorName) return;
    await saveSnapshot();

    console.log("Countertop Color", colorName);

    setConfigBatch(selectedProducts, {
      CountertopColor: colorName,
    });

    dispatch(setActiveCountertopColor(colorName));
    dispatch(setCountertopColorSku(findSkuByColorName(colorName)));
  };

  const handleAddbasinStyle = async (basinStyle: string) => {
    await saveSnapshot();
    console.log("basinStyle", basinStyle);

    setConfigBatch(selectedProducts, {
      sinkType: basinStyle,
    });

    dispatch(setActiveBasinStyle(basinStyle));
  };

  const applyBasinStyleFallback = useCallback(
    (basinStyle: string) => {
      if (!basinStyle) return;
      setConfigBatch(selectedProducts, {
        sinkType: basinStyle,
      });
      dispatch(setActiveBasinStyle(basinStyle));
    },
    [dispatch, selectedProducts],
  );

  const handleAddThickness = useCallback(
    async (thickness: string) => {
      await saveSnapshot();
      console.log("thickness", thickness);

      setConfigBatch(
        {},
        {
          Thickness: thickness,
        },
      );

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

  useEffect(() => {
    const currentStyle = (activeCountertopStyle ?? "").trim().toLowerCase();
    if (currentStyle !== "vessel") return;

    const vesselOption = filteredStyleOptions.find((option) => option.title.toLowerCase() === "vessel");
    if (vesselOption?.isAvailable !== false) return;
    if (vesselOption?.disabledReason !== "No Vessel basin options for current material.") return;

    const integratedOption = filteredStyleOptions.find((option) => option.title.toLowerCase() === "integrated");
    if (!integratedOption?.isAvailable) return;

    dispatch(setCountertopStyle("Integrated"));
  }, [activeCountertopStyle, dispatch, filteredStyleOptions]);

  const handleCountertopStyle = (style: string) => {
    if (!style) return;
    dispatch(setCountertopStyle(style));
  };

  console.log("materials filter options", filteredMaterialFilters.materials);

  const clearAllFilters = () => {
    setSelectedFilter({});
  };

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={filteredMaterialFilters.materials}
        value={selectedFilter.material}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={materialFilters.colors}
        value={selectedFilter.color}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={materialFilters.looks}
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
      id: "counter-top-color",
      title: "Countertop Color",
      defaultOpen: true,
      content: (
        <>
          {/* <ViewModePanel /> */}
          {renderFilters()}
          <ProductOptionsGrid
            data={sortedCountertopOptions}
            handleAdd={handleChangeCountertopColor}
            activeValue={activeCountertopColor}
            isLoading={isFetchingcounterTopMaterials}
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
      id: "countertop-style",
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
        <ProductOptionsGrid data={filteredBasinOptions} handleAdd={handleAddbasinStyle} />
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
