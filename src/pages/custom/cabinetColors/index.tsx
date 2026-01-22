import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";
import type { AccordionConfig } from "@/shared/constants/types";
import { ViewModePanel } from "@/shared/ui/ViewModePanel/ViewModePanel";
import {
  buildMaterialFilters,
  filterOptionsByMaterialSelection,
  getMaterialOptionsGridData,
  type MaterialFilterSelection,
} from "@/shared/constants/materialFilters";

import { optionsMockData3, optionsMockData4 } from "./constants";

import s from "./CustomCabinetColorsPage.module.scss";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  getCabinetColor,
  getDrawerPanelFluting,
  getGrainDirection,
  getHandleGrooveColor,
  getSelectedProductConfig,
  getSelectedProducts,
} from "@/entities/product/model/store/selectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import {
  setCabinetColor,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

const BASE_PANEL_OPTION = "Base Panel";

export const CustomCabinetColorsPage = () => {
  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeCabinetColor = useAppSelector(getCabinetColor);
  const activeGrooveColor = useAppSelector(getHandleGrooveColor);
  const activeDrawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const activeGrainDirection = useAppSelector(getGrainDirection);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const isPlayCanvasReady = usePlayCanvasReady();

  const materialFilters = useMemo(() => buildMaterialFilters(BASE_PANEL_OPTION), []);
  const basePanelOptions = useMemo(() => getMaterialOptionsGridData(BASE_PANEL_OPTION), []);

  const [selectedFilter, setSelectedFilter] = useState<MaterialFilterSelection>({});

  const filteredBasePanelOptions = useMemo(
    () => filterOptionsByMaterialSelection(basePanelOptions, selectedFilter),
    [basePanelOptions, selectedFilter],
  );

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

  const handleChangeColor = (colorName: string) => {
    if (!colorName) return;

    console.log("colorName", colorName);

    setConfigBatch(selectedProducts, {
      CabinetColor: colorName,
    });

    dispatch(setCabinetColor(colorName));
  };

  const handleChangeGrooveColor = (colorName: string) => {
    if (!colorName) return;

    console.log("HandleGrooveColor", colorName);

    setConfigBatch(selectedProducts, {
      HandleGrooveColor: colorName,
    });

    dispatch(
      setSelectedProductConfig({
        ...selectedProductConfig,
        HandleGrooveColor: colorName,
      }),
    );
    dispatch(setHandleGrooveColor(colorName));
  };

  const handleChangeDrawerPanelFluting = (value: string) => {
    if (!value) return;
    setConfigBatch(selectedProducts, {
      DrawerPanelFluting: value,
    });
    dispatch(setDrawerPanelFluting(value));
  };

  const handleChangeGrainDirection = (value: string) => {
    if (!value) return;
    setConfigBatch(selectedProducts, {
      GrainDirection: value,
    });
    dispatch(setGrainDirection(value));
  };

  // Fill all products.
  useEffect(() => {
    if (!isPlayCanvasReady || !activeCabinetColor) return;

    setConfigBatch(selectedProducts, {
      CabinetColor: activeCabinetColor,
    });
  }, [activeCabinetColor, isPlayCanvasReady, selectedProducts]);

  useEffect(() => {
    if (!isPlayCanvasReady || !activeGrooveColor) return;

    setConfigBatch(selectedProducts, {
      HandleGrooveColor: activeGrooveColor,
    });
  }, [activeGrooveColor, isPlayCanvasReady, selectedProducts]);

  // useEffect(() => {
  //   if (!isPlayCanvasReady || !activeDrawerPanelFluting) return;

  //   setConfigBatch(selectedProducts, {
  //     DrawerPanelFluting: activeDrawerPanelFluting,
  //   });
  // }, [activeDrawerPanelFluting, isPlayCanvasReady, selectedProducts]);

  // useEffect(() => {
  //   if (!isPlayCanvasReady || !activeGrainDirection) return;

  //   setConfigBatch(selectedProducts, {
  //     GrainDirection: activeGrainDirection,
  //   });
  // }, [activeGrainDirection, isPlayCanvasReady, selectedProducts]);

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
      id: "groove-color",
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
