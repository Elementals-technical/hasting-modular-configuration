import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductSwatchesGrid } from "@/entities/product/ui/ProductSwatchesGrid/ProductSwatchesGrid";
import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";

const optionsMockData = [
  {
    id: 1,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "Colortech",
    desc: "Grigio fume 10F",
    isShortDesc: false,
  },
  {
    id: 3,
    title: "Cemento",
    desc: "Centre 1A1",
    isShortDesc: false,
  },
  {
    id: 4,
    title: "Cemento",
    desc: "Tortora 1A2",
    isShortDesc: false,
  },
  {
    id: 5,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 7,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 8,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
  {
    id: 9,
    title: "Colortech",
    desc: "Bianco 10B",
    isShortDesc: false,
  },
];

const optionsSwatchData = [
  {
    id: 1,
    title: "None",
  },
  {
    id: 2,
    title: "Auto Fill",
  },
  {
    id: 3,
    title: "Customize",
  },
];

const optionsSwatchData2 = [
  {
    id: 1,
    title: "None",
  },
  {
    id: 2,
    title: "Customize",
  },
];

export const AccessoriesPage = () => {
  return (
    <div className="accessoriesPage">
      <ConfiguratorAccordion title={"Side Panels"} defaultOpen>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"LED"}>
        <ProductSwatchesGrid data={optionsSwatchData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Dividers"}>
        <ProductSwatchesGrid data={optionsSwatchData2} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Towel Bar"}>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>
    </div>
  );
};
