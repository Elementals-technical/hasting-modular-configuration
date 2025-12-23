import { useState } from "react";

import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import type { AccordionConfig } from "@/shared/constants/types";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";

const faucetHolesAmountData = [
  {
    id: 0,
    title: "0",
  },
  {
    id: 1,
    title: "1",
  },
  {
    id: 2,
    title: "2",
  },
  {
    id: 3,
    title: "3",
  },
];

const faucetHolesSpacingOptions = [
  {
    label: '4"',
    value: '4"',
  },
];

export const FaucetPage = () => {
  const [faucetSpacing, setFaucetSpacing] = useState('4"');

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "faucet-holes-amount",
      title: "Faucet Holes Amount",
      defaultOpen: true,
      content: (
        <>
          <ProductSwatchesGrid data={faucetHolesAmountData} />
        </>
      ),
    },
    {
      id: "faucet-holes-spacing",
      title: "Faucet Holes Spacing",
      content: (
        <>
          <FilterSelection
            label="Spacing"
            options={faucetHolesSpacingOptions}
            value={faucetSpacing}
            onSelect={(value) => setFaucetSpacing(String(value))}
          />
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
