import { useMemo, useState } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { buildMaterialFilters, getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getActiveCabinetRule,
  getCountertopStyle,
  getSelectedProducts,
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

import s from "./Countertop.module.scss";

const COUNTERTOP_OPTION = "Counertops materials";

export const CustomCountertopPage = () => {
  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeThickness = useAppSelector(getActiveCountertopThickness);
  const activeCountertopColor = useAppSelector(getActiveCountertopColor);
  const activeCountertopStyle = useAppSelector(getCountertopStyle);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const isSinkDisabled = Boolean(activeCabinetRule) && !activeCabinetRule?.hasSink;

  const [selectedFilter, setSelectedFilter] = useState<{
    material?: string;
    color?: string;
    look?: string;
    hex?: string;
  }>({});
  const materialFilters = useMemo(() => buildMaterialFilters(COUNTERTOP_OPTION), []);

  const { data: counterTopData } = useGetCountertopDatatableQuery(438);
  console.log("counterTopData", counterTopData);

  const countertopOptions = useMemo(() => getMaterialOptionsGridData(COUNTERTOP_OPTION), []);

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
            data={optionsMockData4}
            onSelectChange={(value) => value && handleAddThickness(value)}
            selectedValue={activeThickness}
          />
        </>
      ),
    },
    {
      id: "countertop-style",
      title: "Countertop Style",
      content: (
        <ProductOptionsGrid
          data={optionsMockData2}
          handleAdd={handleCountertopStyle}
          activeValue={activeCountertopStyle}
        />
      ),
    },
    {
      id: "basin-style",
      title: "Basin style",
      content: isSinkDisabled ? (
        <div>Select a cabinet type with sink support to enable basin styles.</div>
      ) : (
        <ProductOptionsGrid data={optionsMockData3} handleAdd={handleAddbasinStyle} />
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
