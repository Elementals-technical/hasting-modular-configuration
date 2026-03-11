import { useCallback, useEffect, useMemo, useState } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopStyle,
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
  normalizeBasinToken,
  normalizeMaterialToken,
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

export const CountertopPage = () => {
  const dispatch = useAppDispatch();
  const saveSnapshot = useHistorySnapshot();
  const presetsProducts = useAppSelector(getProductsPresets);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const hasSelectedMaterial = Boolean(activeCountertopColor);
  const [hasSinkBase, setHasSinkBase] = useState(false);
  const isSinkDisabled = !hasSinkBase;

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});
  const defaultMaterialFilters = useMemo(() => buildMaterialFilters(COUNTERTOP_OPTION), []);

  const { data: counterTopMaterials } = useGetConfiguratorQuery({
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
    const groups = (counterTopMaterials?.availableOptions ?? []).filter((g) => g.proxyName === "Countertop Color");
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

    return groups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = getVariantMeta(variant);
            const metaMaterial = meta.material ?? option.name;
            const metaColor = meta.color;
            const metaLook = meta.look;
            const metaHex = meta.hex;
            const descSource = option.name || group.proxyName || variant.name;

            return {
              id: variant.id,
              title: meta.label ?? variant.name,
              name: variant.name,
              desc: normalizeMaterialLabel(descSource),
              isShortDesc: false,
              metadata: {
                image: meta.image,
                value: meta.value ?? variant.name,
                sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                materials: buildMaterialTokens(
                  option.name || variant.name,
                  metaMaterial,
                  group.proxyName ? [group.proxyName] : [],
                ),
                colors: toStringArrayFromCsv(metaColor),
                looks: toStringArrayFromCsv(metaLook),
                hex: metaHex?.trim(),
              },
            };
          }),
      ),
    );
  }, [counterTopMaterials, getVariantMeta]);

  const countertopOptions = useMemo(() => countertopOptionsFromApi, [countertopOptionsFromApi]);

  const findSkuByColorName = useCallback(
    (colorName: string): string => {
      for (const option of countertopOptionsFromApi) {
        if (option.metadata?.value === colorName || option.name === colorName) {
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

    matrixMaterials.forEach((material) => materialSet.add(normalizeMaterialAlias(material)));

    groups.forEach((group) => {
      group.options.forEach((option) => {
        option.variants?.forEach((variant) => {
          if (!variant.enabled) return;

          const meta = getVariantMeta(variant);
          const metaMaterial = meta.material ?? option.name;
          const metaColor = meta.color;
          const metaLook = meta.look;
          const metaHex = meta.hex;

          const candidateMaterials = [group.proxyName, option.name, ...toStringArrayFromCsv(metaMaterial)]
            .filter(Boolean)
            .map((value) => normalizeMaterialAlias(value)) as string[];

          const matchesMatrix =
            normalizedMatrixMaterials.size === 0 ||
            candidateMaterials.some((value) => normalizedMatrixMaterials.has(normalizeMaterialToken(value)));

          if (!matchesMatrix) return;

          candidateMaterials.forEach((value) => {
            if (normalizedMatrixMaterials.size === 0 || normalizedMatrixMaterials.has(normalizeMaterialToken(value))) {
              materialSet.add(value);
            }
          });

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

  useEffect(() => {
    console.log("[prebuilt][countertop][rules]", {
      selectedDimensions,
      activeCountertopColor,
      activeMaterialTokens,
      activeThickness,
      activeBasinStyle,
      allowedMaterials: Array.from(ruleState.allowedMaterials),
      allowedBasinTokens: Array.from(ruleState.allowedBasinTokens),
    });
  }, [
    selectedDimensions,
    activeCountertopColor,
    activeMaterialTokens,
    activeThickness,
    activeBasinStyle,
    ruleState.allowedMaterials,
    ruleState.allowedBasinTokens,
  ]);

  const allowedMaterials = ruleState.allowedMaterials;

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

  const filteredCountertopOptions = useMemo(() => {
    const filteredByUi = filterOptionsByMaterialSelection(countertopOptions, selectedFilter);

    const filteredByMaterial =
      !allowedMaterials.size || (hasApiOptions && !hasAllowedOptionMatch)
        ? filteredByUi
        : filteredByUi.filter((option) => {
            const materials = option.metadata?.materials ?? [];
            return materials.some((material) => getMaterialAliases(material).some((alias) => allowedMaterials.has(alias)));
          });

    return filterOptionsByTier(filteredByMaterial, selectedFilter.tier);
  }, [allowedMaterials, countertopOptions, hasAllowedOptionMatch, hasApiOptions, selectedFilter]);

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

  const filteredBasinOptions = useMemo(() => {
    if (!optionsMockData3.length) return [];

    const normalizedStyle = activeCountertopStyle ? activeCountertopStyle.trim().toLowerCase() : "";
    const allowedStyles = ruleState.allowedStyles;
    const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));

    const vesselSinkNames = new Set([
      "Vessel_Blade11",
      "Vessel_Blade18",
      "Vessel_UrbanModo",
      "Vessel_UrbanMorris",
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

      return optionsMockData3.filter((option) => {
        const name = option.name ?? "";
        if (!vesselSinkNames.has(name)) return false;
        if (!normalizedActiveMaterials.length) return true;

        const allowedMats = vesselAllowedMaterialsMap[name];
        if (allowedMats === null || allowedMats === undefined) return true;
        return allowedMats.some(
          (mat) => normalizedActiveMaterials.includes(mat) || mat === activeColorCode,
        );
      });
    }

    if (!allowedBasinTokens.size) return [];

    return optionsMockData3.filter((option) => {
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
      const isMaterialSpecific = materialTokens.some((token) => allowedMaterials.has(token));

      if (isMaterialSpecific && normalizedActiveMaterials.length > 0) {
        const matchesMaterial = materialTokens.some((token) => normalizedActiveMaterials.includes(token));
        if (!matchesMaterial) return false;
      }

      const basinLabel = isMaterialSpecific ? restTokens.join(" ") : label;
      const normalized = normalizeBasinToken(basinLabel);

      return Array.from(allowedBasinTokens).some((token) => normalized === token);
    });
  }, [activeCountertopColor, activeCountertopStyle, activeMaterialTokens, allowedBasinTokens, allowedMaterials, ruleState.allowedStyles]);

  const filteredStyleOptions = useMemo(() => {
    const allowed = ruleState.allowedStyles;
    if (!allowed.size) return optionsMockData2;

    return optionsMockData2.map((option) => ({
      ...option,
      isAvailable: allowed.has(option.title.toLowerCase()),
    }));
  }, [ruleState.allowedStyles]);

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

  const presetNames = presetsProducts.map((i) => {
    return i.name;
  });

  const handleChangeCountertopColor = async (colorName: string) => {
    if (!colorName) return;
    await saveSnapshot();

    console.log("Countertop Color", colorName);

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { CountertopColor: colorName });
    });

    dispatch(setActiveCountertopColor(colorName));
    dispatch(setCountertopColorSku(findSkuByColorName(colorName)));
  };

  const handleAddBasinStyle = async (basinStyle: string) => {
    await saveSnapshot();

    setConfigBatch({}, { sinkType: basinStyle });

    dispatch(setActiveBasinStyle(basinStyle));
  };

  const handleAddThickness = useCallback(
    async (thickness: string) => {
      await saveSnapshot();
      console.log("thickness prebuilt", thickness);

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
        <BaseButton onClick={clearAllFilters} size="sm">
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
          {/* <ViewModePanel /> */}
          {renderFilters()}
          <ProductOptionsGrid
            data={sortedCountertopOptions}
            handleAdd={handleChangeCountertopColor}
            activeValue={activeCountertopColor}
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

  return (
    <div className="countertop">
      <ConfiguratorAccordionGroup defaultValue={ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id.toString()}>
        {ACCORDIONS.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id.toString()} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>
    </div>
  );
};
