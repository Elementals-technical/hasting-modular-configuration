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
    id: 6,
    title: "None",
    desc: "Keep same color as cabinet",
  },
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
];

export const CabinetPage = () => {
  return (
    <div className="cabinetPage">
      <ConfiguratorAccordion title={"Cabinet Color"} defaultOpen>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Handle Groove Color (Optional)"}>
        <ProductOptionsGrid data={optionsMockData2} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Drawer Panel Fluting"}>
        <ProductOptionsGrid data={optionsMockData2} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Grain Direction"}>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>
    </div>
  );
};
