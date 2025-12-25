import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { faucetHolesAmountData } from "./constants";
import type { AccordionConfig } from "@/shared/constants/types";
import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getFaucetHolesAmount, getFaucetHolesSpacing } from "@/entities/product/model/store/selectors";
import { setFaucetHolesAmount, setFaucetHolesSpacing } from "@/entities/product/model/store/slice";

const faucetHolesSpacingOptions = [
  {
    label: '4"',
    value: '4"',
  },
];

export const CustomFaucetHolesPage = () => {
  const dispatch = useAppDispatch();
  const faucetSpacing = useAppSelector(getFaucetHolesSpacing);
  const faucetAmount = useAppSelector(getFaucetHolesAmount);

  const handleFaucetAmountChange = (value: string | null) => {
    if (!value) return;
    dispatch(setFaucetHolesAmount(value));
  };

  const handleFaucetSpacingChange = (value: string | number) => {
    dispatch(setFaucetHolesSpacing(String(value)));
  };

  const ACCORDIONS: AccordionConfig[] = [
    {
      id: "faucet-holes-amount",
      title: "Faucet Holes Amount",
      defaultOpen: true,
      content: (
        <>
          <ProductSwatchesGrid
            data={faucetHolesAmountData}
            selectedValue={faucetAmount}
            onSelectChange={handleFaucetAmountChange}
          />
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
            onSelect={handleFaucetSpacingChange}
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
