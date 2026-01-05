import { useMemo, useState } from "react";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { optionsMockData3, optionsMockData4 } from "@/pages/prebuilt/cabinet/constants";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";

import s from "./CabinetPage.module.scss";
import type { AccordionConfig } from "@/shared/constants/types";
import {
  setCabinetColor,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
} from "@/entities/product/model/store/slice";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getCabinetColor,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
  getProductsPresets,
} from "@/entities/product/model/store/selectors";
import { buildMaterialFilters, getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

const BASE_PANEL_OPTION = "Base Panel";

export const CabinetPage = () => {
  const dispatch = useAppDispatch();
  const presetsProducts = useAppSelector(getProductsPresets);
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const activeGrooveColor = useAppSelector(getHandleGrooveColor);
  const activeDrawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const activeGrainDirection = useAppSelector(getGrainDirection);

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
  const grooveColorOptions = useMemo(
    () => [
      {
        id: "groove-color-none",
        title: "None",
        isShortDesc: false,
        metadata: { value: "None" },
      },
      ...sortedBasePanelOptions,
    ],
    [sortedBasePanelOptions],
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

  const presetNames = presetsProducts.map((i) => {
    return i.name;
  });

  const handleChangeColor = (colorName?: string) => {
    if (!colorName) return;

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { CabinetColor: colorName });
    });

    dispatch(setCabinetColor(colorName));
  };

  const handleChangeGrooveColor = (colorName: string) => {
    if (!colorName) return;

    console.log("HandleGrooveColor", colorName);

    presetNames.forEach((productName) => {
      setConfigBatch({ productType: productName }, { HandleGrooveColor: colorName });
    });

    dispatch(setHandleGrooveColor(colorName));
  };

  const handleChangeDrawerPanelFluting = (value: string) => {
    if (!value) return;
    dispatch(setDrawerPanelFluting(value));
  };

  const handleChangeGrainDirection = (value: string) => {
    if (!value) return;
    dispatch(setGrainDirection(value));
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
          <ProductOptionsGrid
            data={sortedBasePanelOptions}
            handleAdd={handleChangeColor}
            activeValue={activeCabinetColor}
          />
        </>
      ),
    },
    {
      id: "handle-groove",
      title: "Handle Groove Color (Optional)",
      content: (
        <>
          <ViewModePanel />
          {renderFilters()}
          <ProductOptionsGrid
            data={grooveColorOptions}
            handleAdd={handleChangeGrooveColor}
            activeValue={activeGrooveColor}
          />
        </>
      ),
    },
    {
      id: "drawer-panel",
      title: "Drawer Panel Fluting",
      content: (
        <ProductOptionsGrid
          data={optionsMockData3}
          handleAdd={handleChangeDrawerPanelFluting}
          activeValue={activeDrawerPanelFluting}
        />
      ),
    },
    {
      id: "grain-direction",
      title: "Grain Direction",
      content: (
        <ProductOptionsGrid
          data={optionsMockData4}
          handleAdd={handleChangeGrainDirection}
          activeValue={activeGrainDirection}
        />
      ),
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
