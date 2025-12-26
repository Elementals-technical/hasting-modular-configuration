import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import {
  getDividersOption,
  getLedOption,
  getSelectedProductConfig,
  getSelectedProducts,
  getSidePanelsOption,
  getTowelBarOption,
} from "@/entities/product/model/store/selectors";
import {
  setDividersOption,
  setLedOption,
  setSidePanelsOption,
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

export const CustomAccessoriesPage = () => {
  const dispatch = useAppDispatch();
  const dividerSelection = useAppSelector(getDividersOption);
  const towelSelection = useAppSelector(getTowelBarOption);
  const activeSidePanels = useAppSelector(getSidePanelsOption);
  const activeLed = useAppSelector(getLedOption);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);

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
    dispatch(setDividersOption(value));
  };

  const handleTowelBarChange = (value: string | null) => {
    if (!value) return;
    dispatch(setTowelBarOption(value));
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
          {dividerSelection === "Customize" && <ProductOptionsGrid data={dividersMockData} />}
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
          {towelSelection && towelSelection !== "None" && <ProductOptionsGrid data={optionsTowelData} />}
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
