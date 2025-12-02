import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { ProductOptionItem } from "@/shared/ui/ProductOptionItem/ProductOptionItem";

export const CountertopPage = () => {
  return (
    <div className="countertop">
      <ConfiguratorAccordion title={"Countertop Color"} defaultOpen>
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Thickness"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Countertop Style"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Basin style"}>
        <ProductOptionItem />
      </ConfiguratorAccordion>
    </div>
  );
};
