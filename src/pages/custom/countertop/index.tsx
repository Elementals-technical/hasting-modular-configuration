import { useMemo } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";
import { getMaterialOptionsGridData } from "@/shared/constants/materialFilters";

import { optionsMockData2, optionsMockData3, optionsMockData4 } from "./constants";
import { getActiveCountertopThickness, getSelectedProducts } from "@/entities/product/model/store/selectors";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import {
  setActiveBasinStyle,
  setActiveCountertopColor,
  setActiveCountertopThickness,
} from "@/entities/product/model/store/slice";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";

const COUNTERTOP_OPTION = "Counertops materials";

export const CustomCountertopPage = () => {
  const dispatch = useAppDispatch();
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeThickness = useAppSelector(getActiveCountertopThickness);

  const countertopOptions = useMemo(
    () => getMaterialOptionsGridData(COUNTERTOP_OPTION).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    [],
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

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "counter-top-color",
      title: "Countertop Color",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid data={countertopOptions} handleAdd={handleChangeCountertopColor} />
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
      content: <ProductOptionsGrid data={optionsMockData2} />,
    },
    {
      id: "basin-style",
      title: "Basin style",
      content: <ProductOptionsGrid data={optionsMockData3} handleAdd={handleAddbasinStyle} />,
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
