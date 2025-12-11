import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";

import { optionsMockData, optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CustomCabinetColorsPage.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setCabinetColor } from "@/entities/product/model/store/slice";

export const CustomCabinetColorsPage = () => {
  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);

  console.log("selectedProducts", selectedProducts);

  const renderFiltersForCabinetColor = () => (
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

  const renderFiltersForHandleColor = () => (
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

  const handleChangeColor = (colorName?: string) => {
    if (!colorName) return;

    console.log(colorName);

    setConfigBatch(selectedProducts, {
      CabinetColor: "White Matte",
    });

    dispatch(setCabinetColor(colorName));
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: 1,
      title: "Cabinet Color",
      defaultOpen: true,
      content: (
        <>
          <ViewModePanel />
          {renderFiltersForCabinetColor()}
          <ProductOptionsGrid data={optionsMockData} handleAdd={handleChangeColor} />
        </>
      ),
    },
    {
      id: 2,
      title: "Handle Groove Color (Optional)",
      content: (
        <>
          <ViewModePanel />
          {renderFiltersForHandleColor()}
          <ProductOptionsGrid data={optionsMockData2} />
        </>
      ),
    },
    {
      id: 3,
      title: "Drawer Panel Fluting",
      content: <ProductOptionsGrid data={optionsMockData3} />,
    },
    {
      id: 4,
      title: "Grain Direction",
      content: <ProductOptionsGrid data={optionsMockData4} />,
    },
  ];

  return (
    <div className={s.cabinetPage}>
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
