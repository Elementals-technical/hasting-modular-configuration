import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { optionsMockData } from "./constants";
import type { AccordionConfig } from "@/shared/constants/types";

export const CustomFaucetHolesPage = () => {
  const ACCORDIONS: AccordionConfig[] = [
    {
      id: 1,
      title: "Faucet Holes Amount",
      defaultOpen: true,
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
        </>
      ),
    },
    {
      id: 2,
      title: "Faucet Holes Spacing",
      content: (
        <>
          <ProductOptionsGrid data={optionsMockData} />
        </>
      ),
    },
  ];

  return (
    <div className="faucetPage">
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
