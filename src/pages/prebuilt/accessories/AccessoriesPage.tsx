import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";

import { optionsMockData, optionsSwatchData, optionsSwatchData2 } from "./constants";

export const AccessoriesPage = () => {
  const ACCORDIONS: AccordionConfig[] = [
    {
      id: 1,
      title: "Side Panels",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
        </>
      ),
    },
    {
      id: 2,
      title: "LED",
      content: (
        <>
          <ProductSwatchesGrid data={optionsSwatchData} />
        </>
      ),
    },
    {
      id: 3,
      title: "Dividers",
      content: (
        <>
          <ProductSwatchesGrid data={optionsSwatchData2} />
        </>
      ),
    },
    {
      id: 4,
      title: "Towel Bar",
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
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
