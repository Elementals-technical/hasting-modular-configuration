import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

export const FaucetPage = () => {
  return (
    <div className="faucetPage">
      <ConfiguratorAccordion title={"Faucet Holes Amount"} defaultOpen>
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Faucet Holes Spacing"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>
    </div>
  );
};
