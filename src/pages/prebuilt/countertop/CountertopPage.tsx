import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";

const optionsMockData = [
  {
    id: 1,
    title: "Colortech",
    desc: "Bianco 10B",
  },
  {
    id: 2,
    title: "Colortech",
    desc: "Grigio fume 10F",
  },
  {
    id: 3,
    title: "Cemento",
    desc: "Centre 1A1",
  },
  {
    id: 4,
    title: "Cemento",
    desc: "Tortora 1A2",
  },
  {
    id: 5,
    title: "Colortech",
    desc: "Bianco 10B",
  },
  {
    id: 7,
    title: "Colortech",
    desc: "Bianco 10B",
  },
  {
    id: 8,
    title: "Colortech",
    desc: "Bianco 10B",
  },
  {
    id: 9,
    title: "Colortech",
    desc: "Bianco 10B",
  },
];

const optionsMockData2 = [
  {
    id: 1,
    title: "Integrated",
    isAvailable: false,
  },
  {
    id: 2,
    title: "Vessel",
    isAvailable: true,
  },
  {
    id: 3,
    title: "Undermount",
    isAvailable: false,
  },
];

export const CountertopPage = () => {
  return (
    <div className="countertop">
      <ConfiguratorAccordion title={"Countertop Color"} defaultOpen>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Thickness"}>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Countertop Style"}>
        <ProductOptionsGrid data={optionsMockData2} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Basin style"}>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>
    </div>
  );
};
