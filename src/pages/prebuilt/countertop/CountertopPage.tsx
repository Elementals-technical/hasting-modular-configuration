import { useMemo, useState } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getCountertopStyle,
  getProductsPresets,
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
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
  getMaterialOptionsGridData,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";
import { useGetCountertopDatatableQuery } from "@/entities/countertop";
import {
  buildCountertopRuleState,
  getMaterialAliases,
  normalizeBasinToken,
  normalizeMaterialToken,
  parseCountertopMatrix,
} from "@/features/configurator-rule-core/countertop";

import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch.ts";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CountertopPage.module.scss";

export const CountertopPage = () => {
  const dispatch = useAppDispatch();
  const presetsProducts = useAppSelector(getProductsPresets);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeBasinStyle = useAppSelector(getSinkType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);

  const materialFilters = useMemo(() => buildMaterialFilters("Counertops materials"), []);
  const countertopOptions = useMemo(() => getMaterialOptionsGridData("Counertops materials"), []);
  const { data: counterTopData } = useGetCountertopDatatableQuery(438);
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
    if (!allowedBasinTokens.size) return optionsMockData3;
    return optionsMockData3.filter((option) => {
      const composite = `${option.title ?? ""} ${option.name ?? ""}`.trim();
      const normalized = normalizeBasinToken(composite);
      return Array.from(allowedBasinTokens).some((token) => normalized.includes(token) || token.includes(normalized));
    });
  }, [allowedBasinTokens]);

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
          <ProductSwatchesGrid
            data={filteredThicknessOptions}
            onSelectChange={(value) => value && handleAddThickness(value)}
            selectedValue={activeThickness}
          />
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
      content: <ProductOptionsGrid handleAdd={handleAddBasinStyle} data={filteredBasinOptions} />,
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
