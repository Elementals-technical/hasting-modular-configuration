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
} from "@/entities/product/model/store/slice.ts";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux.ts";
import {
  filterOptionsByMaterialSelection,
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
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CountertopPage.module.scss";

export const CountertopPage = () => {
  const dispatch = useAppDispatch();
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

  const { data: configuratorData } = useGetConfiguratorQuery({
    id: 4,
    view: "full",
    serialize: true,
  });

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);

  const toOptionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

  const toStringArrayFromCsv = (value: unknown): string[] => {
    if (typeof value !== "string") return [];
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  };

  const getVariantMeta = useCallback(
    (variant: { metadata?: Record<string, unknown>; name: string; image?: string | null }) => {
      const meta = (variant.metadata ?? {}) as Record<string, unknown>;
      const pick = (...values: unknown[]): string | undefined => {
        for (const v of values) {
          const str = toOptionalString(v);
          if (str) return str;
        }
        return undefined;
      };
      return {
        material: pick(meta.Material),
        color: pick(meta.Color),
        look: pick(meta.Look),
        hex: pick(meta.hex),
        image: pick(meta.image, variant.image),
        value: pick(meta.value, variant.name),
        label: pick(meta.label, meta.Label, variant.name),
      };
    },
    [],
  );

  const countertopGroups = useMemo(
    () => (configuratorData?.availableOptions ?? []).filter((g) => g.proxyName === "Countertop Color"),
    [configuratorData],
  );

  const countertopOptions = useMemo(() => {
    if (!countertopGroups.length) return [];
    return countertopGroups.flatMap((group) =>
      group.options.flatMap((option) =>
        option.variants
          .filter((variant) => variant.enabled)
          .map((variant) => {
            const meta = getVariantMeta(variant);
            return {
              id: variant.id,
              title: meta.label ?? variant.name,
              name: variant.name,
              desc: option.name ?? group.proxyName,
              isShortDesc: false,
              metadata: {
                image: meta.image,
                value: meta.value ?? variant.name,
                sku: toOptionalString((variant.metadata as Record<string, unknown>)?.sku),
                materials: [
                  ...new Set([group.proxyName, option.name, ...toStringArrayFromCsv(meta.material)].filter(Boolean)),
                ],
                colors: toStringArrayFromCsv(meta.color),
                looks: toStringArrayFromCsv(meta.look),
                hex: meta.hex?.trim(),
              },
            };
          }),
      ),
    );
  }, [countertopGroups, getVariantMeta]);

  const materialFilters = useMemo(() => {
    if (!countertopGroups.length) return { materials: [], colors: [], looks: [], hex: [] };
    const materialSet = new Set<string>();
    const colorSet = new Set<string>();
    const lookSet = new Set<string>();
    const hexSet = new Set<string>();

    countertopGroups.forEach((group) => {
      if (group.proxyName) materialSet.add(group.proxyName);
      group.options.forEach((option) => {
        if (option.name) materialSet.add(option.name);
        option.variants?.forEach((variant) => {
          if (!variant.enabled) return;
          const meta = getVariantMeta(variant);
          if (meta.material) toStringArrayFromCsv(meta.material).forEach((v) => materialSet.add(v));
          toStringArrayFromCsv(meta.color).forEach((v) => colorSet.add(v));
          toStringArrayFromCsv(meta.look).forEach((v) => lookSet.add(v));
          if (meta.hex) hexSet.add(meta.hex.trim());
        });
      });
    });

    const toOptions = (set: Set<string>) =>
      Array.from(set).sort((a, b) => a.localeCompare(b)).map((value) => ({ label: value, value }));

    return { materials: toOptions(materialSet), colors: toOptions(colorSet), looks: toOptions(lookSet), hex: toOptions(hexSet) };
  }, [countertopGroups, getVariantMeta]);
  const countertopRules = useMemo(() => parseCountertopMatrix(counterTopData), [counterTopData]);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});

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

  const filteredMaterialFilters = useMemo(() => {
    if (!allowedMaterials.size) return materialFilters;

    return {
      ...materialFilters,
      materials: materialFilters.materials.filter((item) =>
        allowedMaterials.has(normalizeMaterialToken(item.value)),
      ),
    };
  }, [allowedMaterials, materialFilters]);

  const filteredCountertopOptions = useMemo(() => {
    const filteredByUi = filterOptionsByMaterialSelection(countertopOptions, selectedFilter);

    if (!allowedMaterials.size) return filteredByUi;

    return filteredByUi.filter((option) => {
      const materials = option.metadata?.materials ?? [];
      return materials.some((material) =>
        getMaterialAliases(material).some((alias) => allowedMaterials.has(alias)),
      );
    });
  }, [allowedMaterials, countertopOptions, selectedFilter]);

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
    if (!allowedBasinTokens.size) return [];
    const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));

    return optionsMockData3.filter((option) => {
      const label = option.title ?? option.name ?? "";
      if (!label) return false;

      const [firstToken, ...restTokens] = label.trim().split(/\s+/);
      const materialTokens = firstToken
        ? firstToken.split("/").map((token) => normalizeMaterialToken(token)).filter(Boolean)
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
  }, [activeMaterialTokens, allowedBasinTokens, allowedMaterials]);

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

  const handleChangeCountertopColor = (colorName: string) => {
    if (!colorName) return;

    console.log("Countertop Color", colorName);

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { CountertopColor: colorName });
    });

    dispatch(setActiveCountertopColor(colorName));
  };

  const handleAddBasinStyle = (basinStyle: string) => {
    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { sinkType: basinStyle });
    });

    dispatch(setActiveBasinStyle(basinStyle));
  };

  const handleAddThickness = (thickness: string) => {
    console.log("thickness prebuilt", thickness);

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { Thickness: thickness });
    });

    dispatch(setActiveCountertopThickness(thickness));
  };

  const handleCountertopStyle = (style: string) => {
    if (!style) return;
    dispatch(setCountertopStyle(style));
  };

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={filteredMaterialFilters.materials}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, material: value as string }))}
      />

      <FilterItem
        label="Color"
        options={materialFilters.colors}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, color: value as string }))}
      />

      <FilterItem
        label="Look"
        options={materialFilters.looks}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, look: value as string }))}
      />

      <FilterItem
        label="Price"
        options={materialFilters.hex}
        onSelect={(value) => setSelectedFilter((prev) => ({ ...prev, hex: value as string }))}
      />
    </FilterRow>
  );

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "countertop-color",
      title: "Countertop Color",
      defaultOpen: true,
      content: (
        <>
          <ViewModePanel />
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
        <>
          {hasSelectedMaterial ? (
            <ProductSwatchesGrid
              data={filteredThicknessOptions}
              onSelectChange={(value) => value && handleAddThickness(value)}
              selectedValue={activeThickness}
            />
          ) : (
            <div>Select a material first to enable thickness options.</div>
          )}
        </>
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
