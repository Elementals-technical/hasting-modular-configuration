import { useCallback, useEffect, useMemo, useState } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import {
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
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
import {
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setCountertopStyle,
} from "@/entities/product/model/store/slice";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import {
  buildCountertopRuleState,
  getMaterialAliases,
  normalizeBasinToken,
  normalizeMaterialToken,
  parseCountertopMatrix,
} from "@/features/configurator-rule-core/countertop";

import s from "./Countertop.module.scss";
import { useGetConfiguratorQuery } from "@/entities";

const COUNTERTOP_OPTION = "Counertops materials";

export const CustomCountertopPage = () => {
  const dispatch = useAppDispatch();
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
    id: 1,
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

  const countertopOptionsFromApi = useMemo(() => {
    const group = counterTopMaterials?.availableOptions?.[0];
    console.log("group", group);

    if (!group) return [];

    const buildMaterialTokens = (name: string, metaMaterial?: string) => {
      const tokens = new Set<string>();
      if (metaMaterial) {
        metaMaterial
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((token) => tokens.add(token));
      }
      if (name) tokens.add(name);

      const parts = name
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) tokens.add(parts[parts.length - 1]);
      return Array.from(tokens);
    };

    return group.options.flatMap((option) =>
      option.variants
        .filter((variant) => variant.enabled)
        .map((variant) => ({
          id: variant.id,
          title: variant.name,
          name: variant.name,
          desc: normalizeMaterialLabel(option.name),
          isShortDesc: false,
          metadata: {
            image: variant.image,
            value: variant.name,
            materials: buildMaterialTokens(option.name, variant.metadata?.Material),
            colors: variant.metadata?.Color ? [variant.metadata.Color] : [],
            looks: variant.metadata?.Look ? [variant.metadata.Look] : [],
            hex: variant.metadata?.hex?.trim(),
          },
        })),
    );
  }, [counterTopMaterials]);

  console.log("countertopOptionsFromApi", countertopOptionsFromApi);

  const countertopOptions = useMemo(() => countertopOptionsFromApi, [countertopOptionsFromApi]);
  const countertopRules = useMemo(() => parseCountertopMatrix(counterTopData), [counterTopData]);

  console.log("countertopOptions", countertopOptions);

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
    const group = counterTopMaterials?.availableOptions?.[0];
    if (!group) return defaultMaterialFilters;

    const materialSet = new Set<string>();
    const colorSet = new Set<string>();
    const lookSet = new Set<string>();
    const hexSet = new Set<string>();

    group.options.forEach((option) => {
      materialSet.add(normalizeMaterialLabel(option.name));

      option.variants?.forEach((variant) => {
        if (!variant.enabled) return;

        if (variant.metadata?.Material) {
          variant.metadata.Material.split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .forEach((value) => materialSet.add(value));
        }

        if (variant.metadata?.Color) colorSet.add(variant.metadata.Color);
        if (variant.metadata?.Look) lookSet.add(variant.metadata.Look);
        if (variant.metadata?.hex) hexSet.add(variant.metadata.hex.trim());
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
  }, [counterTopMaterials, defaultMaterialFilters]);

  const hasApiOptions = countertopOptionsFromApi.length > 0;
  const hasAllowedOptionMatch = useMemo(() => {
    if (!allowedMaterials.size) return true;
    if (!hasApiOptions) return true;

    return countertopOptionsFromApi.some((option) => {
      const materials = option.metadata?.materials ?? [];
      return materials.some((material) => getMaterialAliases(material).some((alias) => allowedMaterials.has(alias)));
    });
  }, [allowedMaterials, countertopOptionsFromApi, hasApiOptions]);

  const filteredMaterialFilters = useMemo(() => materialFilters, [materialFilters]);

  const filteredCountertopOptions = useMemo(() => {
    const filteredByUi = filterOptionsByMaterialSelection(countertopOptions, selectedFilter);

    if (!allowedMaterials.size || (hasApiOptions && !hasAllowedOptionMatch)) return filteredByUi;

    return filteredByUi.filter((option) => {
      const materials = option.metadata?.materials ?? [];
      return materials.some((material) => getMaterialAliases(material).some((alias) => allowedMaterials.has(alias)));
    });
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
    if (!allowedBasinTokens.size) return [];
    const normalizedActiveMaterials = activeMaterialTokens.map((material) => normalizeMaterialToken(material));

    return optionsMockData3.filter((option) => {
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

  const handleChangeCountertopColor = (colorName: string) => {
    if (!colorName) return;

    console.log("Countertop Color", colorName);

    setConfigBatch(selectedProducts, {
      CountertopColor: colorName,
    });

    dispatch(setActiveCountertopColor(colorName));
  };

  const handleAddbasinStyle = (basinStyle: string) => {
    console.log("basinStyle", basinStyle);

    setConfigBatch(selectedProducts, {
      sinkType: basinStyle,
    });

    dispatch(setActiveBasinStyle(basinStyle));
  };

  const handleAddThickness = (thickness: string) => {
    console.log("thickness", thickness);

    setConfigBatch(selectedProducts, {
      Thickness: thickness,
    });

    dispatch(setActiveCountertopThickness(thickness));
  };

  const handleCountertopStyle = (style: string) => {
    if (!style) return;
    dispatch(setCountertopStyle(style));
  };

  console.log("materials filter options", filteredMaterialFilters.materials);

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
      id: "counter-top-color",
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
            isLoading={isFetchingcounterTopMaterials}
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
