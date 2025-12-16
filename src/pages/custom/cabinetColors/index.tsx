import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import { buildMaterialFilters, getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

import { optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CustomCabinetColorsPage.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setCabinetColor } from "@/entities/product/model/store/slice";

const BASE_PANEL_OPTION = "Base Panel";

export const CustomCabinetColorsPage = () => {
  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);

  const materialFilters = useMemo(() => buildMaterialFilters(BASE_PANEL_OPTION), []);
  const basePanelOptions = useMemo(() => getMaterialOptionsGridData(BASE_PANEL_OPTION), []);

  const [selectedFilter, setSelectedFilter] = useState<{
    material?: string;
    color?: string;
    look?: string;
    hex?: string;
  }>({});

  const filteredBasePanelOptions = useMemo(() => {
    return basePanelOptions.filter((option) => {
      const { materials, colors, looks, hex } = option.metadata ?? {};

      const materialMatch = selectedFilter.material ? materials?.includes(selectedFilter.material) : true;
      const colorMatch = selectedFilter.color ? colors?.includes(selectedFilter.color) : true;
      const lookMatch = selectedFilter.look ? looks?.includes(selectedFilter.look) : true;
      const hexMatch = selectedFilter.hex ? hex === selectedFilter.hex : true;

      return materialMatch && colorMatch && lookMatch && hexMatch;
    });
  }, [basePanelOptions, selectedFilter]);

  const sortedBasePanelOptions = useMemo(
    () => [...filteredBasePanelOptions].sort((a, b) => a.title.localeCompare(b.title)),
    [filteredBasePanelOptions],
  );

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

  const handleChangeColor = (colorName: string) => {
    if (!colorName) return;

    console.log("colorName", colorName);

    setConfigBatch(selectedProducts, {
      CabinetColor: colorName,
    });

    dispatch(setCabinetColor(colorName));
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "cabinet-color",
      title: "Cabinet Color",
      defaultOpen: true,
      content: (
        <>
          <ViewModePanel />
          {renderFilters()}
          <ProductOptionsGrid data={sortedBasePanelOptions} handleAdd={handleChangeColor} />
        </>
      ),
    },
    {
      id: "groove-color",
      title: "Handle Groove Color (Optional)",
      content: (
        <>
          <ViewModePanel />
          {renderFilters()}
          <ProductOptionsGrid data={sortedBasePanelOptions} />
        </>
      ),
    },
    {
      id: "drawer-panel",
      title: "Drawer Panel Fluting",
      content: <ProductOptionsGrid data={optionsMockData3} />,
    },
    {
      id: "grain-direction",
      title: "Grain Direction",
      content: <ProductOptionsGrid data={optionsMockData4} />,
    },
  ];

  const defaultValue = ACCORDIONS.find((accordion) => accordion.defaultOpen)?.id;

  const [searchParams] = useSearchParams();
  const [accordionValue, setAccordionValue] = useState(defaultValue);

  useEffect(() => {
    const target = searchParams.get("accordion");
    if (target) setAccordionValue(target);
  }, [searchParams]);

  return (
    <div className={s.cabinetPage}>
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
