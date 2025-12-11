import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import {
  optionsMockData,
  optionsMockData2,
  optionsMockData3,
  optionsMockData4,
} from "@/pages/prebuilt/cabinet/constants";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";

import s from "./CabinetPage.module.scss";
import type { AccordionConfig } from "@/shared/constants/types";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { setCabinetColor } from "@/entities/product/model/store/slice";

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

export const CabinetPage = () => {
  const dispatch = useAppDispatch();

  const handleChangeColor = (colorName?: string) => {
    if (!colorName) return;

    console.log(colorName);

    setConfigBatch({ productType: "CabinetUniBox" }, { CabinetColor: "Arancio Zucca 09 MT" });

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
          {renderFilters()}
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
          {renderFilters()}
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
