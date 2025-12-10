import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import type { AccordionConfig } from "@/shared/constants/types";

import { optionsMockData, optionsMockData2, optionsMockData3 } from "./constants";

export const CustomCountertopPage = () => {
  const ACCORDIONS: AccordionConfig[] = [
    {
      id: 1,
      title: "Countertop Color",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
        </>
      ),
    },
    {
      id: 2,
      title: "Thickness",
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
        </>
      ),
    },
    {
      id: 3,
      title: "Countertop Style",
      content: <ProductOptionsGrid data={optionsMockData2} />,
    },
    {
      id: 4,
      title: "Basin style",
      content: <ProductOptionsGrid data={optionsMockData3} />,
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
