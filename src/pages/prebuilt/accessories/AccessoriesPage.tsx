import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

export const AccessoriesPage = () => {
  return (
    <div className="accessoriesPage">
      <ConfiguratorAccordion title={"Side Panels"} defaultOpen>
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"LED"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Dividers"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Towel Bar"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>
    </div>
  );
};
