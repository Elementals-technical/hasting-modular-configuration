import { useMemo, useState } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { getActiveCountertopColor, getProductsPresets } from "@/entities/product/model/store/selectors.ts";
import {
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
} from "@/entities/product/model/store/slice.ts";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux.ts";
import { buildMaterialFilters, getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch.ts";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CountertopPage.module.scss";

export const CountertopPage = () => {
  const dispatch = useAppDispatch();
  const presetsProducts = useAppSelector(getProductsPresets);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);

  const materialFilters = useMemo(() => buildMaterialFilters("Counertops materials"), []);
  const countertopOptions = useMemo(() => getMaterialOptionsGridData("Counertops materials"), []);

  const [selectedFilter, setSelectedFilter] = useState<{
    material?: string;
    color?: string;
    look?: string;
    hex?: string;
  }>({});

  const filteredCountertopOptions = useMemo(() => {
    return countertopOptions.filter((option) => {
      const { materials, colors, looks, hex } = option.metadata ?? {};

      const materialMatch = selectedFilter.material ? materials?.includes(selectedFilter.material) : true;
      const colorMatch = selectedFilter.color ? colors?.includes(selectedFilter.color) : true;
      const lookMatch = selectedFilter.look ? looks?.includes(selectedFilter.look) : true;
      const hexMatch = selectedFilter.hex ? hex === selectedFilter.hex : true;

      return materialMatch && colorMatch && lookMatch && hexMatch;
    });
  }, [countertopOptions, selectedFilter]);

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

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={materialFilters.materials}
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
          <ProductSwatchesGrid data={optionsMockData4} onSelectChange={(value) => value && handleAddThickness(value)} />
        </>
      ),
    },
    {
      id: "countertop-styles",
      title: "Countertop Style",
      content: <ProductOptionsGrid data={optionsMockData2} />,
    },
    {
      id: "basin-style",
      title: "Basin style",
      content: <ProductOptionsGrid handleAdd={handleAddBasinStyle} data={optionsMockData3} />,
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
