import { useState } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";

import { optionsMockData, optionsSwatchData, optionsSwatchData2, optionsSwatchDataTowel } from "./constants";

export const AccessoriesPage = () => {
  const [towelSelection, setTowelSelection] = useState<string | null>(null);

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "side-panels",
      title: "Side Panels",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
        </>
      ),
    },
    {
      id: "led",
      title: "LED",
      content: (
        <>
          <ProductSwatchesGrid data={optionsSwatchData} isLedSection={true} />
        </>
      ),
    },
    {
      id: "dividers",
      title: "Dividers",
      content: (
        <>
          <ProductSwatchesGrid data={optionsSwatchData2} />
        </>
      ),
    },
    {
      id: "towel-bar",
      title: "Towel Bar",
      content: (
        <>
          <ProductSwatchesGrid data={optionsSwatchDataTowel} onSelectChange={setTowelSelection} />
          {towelSelection && towelSelection !== "None" && <ProductOptionsGrid data={optionsMockData} />}
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
