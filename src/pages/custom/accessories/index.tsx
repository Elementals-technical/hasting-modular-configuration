import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getDividersStyle,
  getLedOption,
  getSelectedProductConfig,
  getSelectedProducts,
  getSidePanelsOption,
  getTowelBarColor,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import {
  setDividersOption,
  setDividersStyle,
  setLedOption,
  setSidePanelsOption,
  setTowelBarColor,
  setTowelBarOption,
} from "@/entities/product/model/store/slice";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

import {
  dividersMockData,
  optionsSidePanelsData,
  optionsSwatchData,
  optionsSwatchData2,
  optionsSwatchDataTowel,
  optionsTowelData,
} from "./constants";
import { setVisibleDrawerButtons } from "@/utils/functions/playcanvas/setVisibleDrawerButtons.ts";

export const CustomAccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const dividerSelection = useAppSelector(getDividersOption);
  const dividerStyle = useAppSelector(getDividersStyle);
  const towelSelection = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const activeLed = useAppSelector(getLedOption);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

  useEffect(() => {
    if (towelSelection !== "None") return;

    setConfigBatch(
      {},
      {
        TowelBar: "None",
        TowelBarSide: "both",
      },
    );
  }, [towelSelection]);

  const handleSidePanelsChange = async (value: string) => {
    if (!value) return;

    await setConfigBatch(selectedProducts, {
      ...selectedProductConfig,
      SidePanel: value,
    });

    dispatch(setSidePanelsOption(value));
  };

  const handleLedChange = (value: string | null) => {
    if (!value) return;
    dispatch(setLedOption(value));
  };

  const handleDividersChange = (value: string | null) => {
    if (!value) return;

    if (value === "Customize") {
      setVisibleDrawerButtons(true);
    } else {
      setVisibleDrawerButtons(false);
    }

    dispatch(setDividersOption(value));

    if (value !== "Customize") {
      dispatch(setDividersStyle(""));
    }
  };

  const handleDividerStyleChange = (value: string) => {
    if (!value) return;
    dispatch(setDividersStyle(value));
  };

  const handleTowelBarChange = async (value: string | null) => {
    if (!value) return;

    const isNone = value === "None";
    const side = value.toLowerCase() as "left" | "right" | "both";

    await setConfigBatch(
      {},
      {
        TowelBar: isNone ? "None" : "TowelBar40_R",
        TowelBarSide: isNone ? "both" : side,
      },
    );

    if (isNone) {
      dispatch(setTowelBarColor(""));
    }

    dispatch(setTowelBarOption(value));
  };

  const handleTowelBarColorChange = (value?: string) => {
    if (!value) return;

    setConfigBatch(
      {},
      {
        TowelBarColor: value,
      },
    );

    dispatch(setTowelBarColor(value));
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "side-panels",
      title: "Side Panels",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid
            data={optionsSidePanelsData}
            handleAdd={handleSidePanelsChange}
            activeValue={activeSidePanels}
          />
        </>
      ),
    },
    {
      id: "led",
      title: "LED",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchData}
            isLedSection={true}
            selectedValue={activeLed}
            onSelectChange={handleLedChange}
          />
        </>
      ),
    },
    {
      id: "dividers",
      title: "Dividers",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchData2}
            onSelectChange={handleDividersChange}
            selectedValue={dividerSelection}
          />
          {dividerSelection === "Customize" && (
            <ProductOptionsGrid
              data={dividersMockData}
              handleAdd={handleDividerStyleChange}
              activeValue={dividerStyle}
            />
          )}
        </>
      ),
    },
    {
      id: "tovel-bar",
      title: "Towel Bar",
      content: (
        <>
          <ProductSwatchesGrid
            data={optionsSwatchDataTowel}
            onSelectChange={handleTowelBarChange}
            selectedValue={towelSelection}
          />
          {towelSelection && towelSelection !== "None" && (
            <ProductOptionsGrid
              data={optionsTowelData}
              handleAdd={handleTowelBarColorChange}
              activeValue={towelBarColor}
            />
          )}
        </>
      ),
    },
  ];

  return (
    <div className="accessoriesPage">
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
