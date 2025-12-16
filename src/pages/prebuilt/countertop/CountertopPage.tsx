import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { getProductsPresets } from "@/entities/product/model/store/selectors.ts";
import { setActiveBasinStyle, setActiveCountertopColor } from "@/entities/product/model/store/slice.ts";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import type { AccordionConfig } from "@/shared/constants/types";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux.ts";

import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch.ts";

import { optionsMockData, optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CountertopPage.module.scss";

export const CountertopPage = () => {
  const dispatch = useAppDispatch();
  const presetsProducts = useAppSelector(getProductsPresets);

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

  const renderFilters = () => (
    <FilterRow className={s.innerRow}>
      <FilterItem
        label="Material"
        options={[
          { label: "Small", value: "s" },
          { label: "Medium", value: "m" },
          { label: "Large", value: "l" },
        ]}
      />

      <FilterItem
        label="Color"
        options={[
          { label: "Style 1", value: "s" },
          { label: "Style 2", value: "m" },
          { label: "Style 3", value: "l" },
        ]}
      />

      <FilterItem
        label="Look"
        options={[
          { label: "Style 1", value: "s" },
          { label: "Style 2", value: "m" },
          { label: "Style 3", value: "l" },
        ]}
      />

      <FilterItem
        label="Price"
        options={[
          { label: "Style 1", value: "s" },
          { label: "Style 2", value: "m" },
          { label: "Style 3", value: "l" },
        ]}
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
          <ProductOptionsGrid data={optionsMockData} handleAdd={handleChangeCountertopColor} />
        </>
      ),
    },
    {
      id: "thickness",
      title: "Thickness",
      content: (
        <>
          <ProductSwatchesGrid data={optionsMockData4} />
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
