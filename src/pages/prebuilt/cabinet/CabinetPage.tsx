import { Link } from "react-router-dom";

import { FilterItem } from "@/features/filters/ui/filterItem/FilterItem";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";

import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { FilterRow } from "@/shared/ui/Filter/FilterRow";

import s from "./CabinetPage.module.scss";

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

const optionsMockData2 = [
  {
    id: 6,
    title: "None",
    desc: "Keep same color as cabinet",
    isShortDesc: false,
  },
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
];

const optionsMockData3 = [
  {
    id: 6,
    title: "None",
    isShortDesc: false,
  },
  {
    id: 1,
    title: "Uniform",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "Staggered",
    isShortDesc: false,
  },
  {
    id: 3,
    title: "Cannete",
    isShortDesc: false,
  },
  {
    id: 4,
    title: "Rigatino",
    isShortDesc: false,
  },
];

const optionsMockData4 = [
  {
    id: 1,
    title: "Horizontal",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "Vertical",
    isShortDesc: false,
  },
];

export const CabinetPage = () => {
  return (
    <div className={s.cabinetPage}>
      <ConfiguratorAccordion title={"Cabinet Color"} defaultOpen>
        <div className={s.viewTopPanel}>
          <div className={s.leftText}>
            <Link to={"#"}>View in full mode</Link>
          </div>
          <div className={s.rightText}>
            <Link to={"#"}>Order free Swatches</Link>
          </div>
        </div>

        <FilterRow className={s.innerRow}>
          <FilterItem
            label="Material"
            options={[
              { label: "Small", value: "s" },
              { label: "Medium", value: "m" },
              { label: "Large", value: "l" },
            ]}
          />

          <FilterItem
            label="Color"
            options={[
              { label: "Style 1", value: "s" },
              { label: "Style 2", value: "m" },
              { label: "Style 3", value: "l" },
            ]}
          />

          <FilterItem
            label="Look"
            options={[
              { label: "Style 1", value: "s" },
              { label: "Style 2", value: "m" },
              { label: "Style 3", value: "l" },
            ]}
          />

          <FilterItem
            label="Price"
            options={[
              { label: "Style 1", value: "s" },
              { label: "Style 2", value: "m" },
              { label: "Style 3", value: "l" },
            ]}
          />
        </FilterRow>

        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Handle Groove Color (Optional)"}>
        <div className={s.viewTopPanel}>
          <div className={s.leftText}>
            <Link to={"#"}>View in full mode</Link>
          </div>
          <div className={s.rightText}>
            <Link to={"#"}>Order free Swatches</Link>
          </div>
        </div>

        <FilterRow className={s.innerRow}>
          <FilterItem
            label="Material"
            options={[
              { label: "Small", value: "s" },
              { label: "Medium", value: "m" },
              { label: "Large", value: "l" },
            ]}
          />

          <FilterItem
            label="Color"
            options={[
              { label: "Style 1", value: "s" },
              { label: "Style 2", value: "m" },
              { label: "Style 3", value: "l" },
            ]}
          />

          <FilterItem
            label="Look"
            options={[
              { label: "Style 1", value: "s" },
              { label: "Style 2", value: "m" },
              { label: "Style 3", value: "l" },
            ]}
          />

          <FilterItem
            label="Price"
            options={[
              { label: "Style 1", value: "s" },
              { label: "Style 2", value: "m" },
              { label: "Style 3", value: "l" },
            ]}
          />
        </FilterRow>

        <ProductOptionsGrid data={optionsMockData2} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Drawer Panel Fluting"}>
        <ProductOptionsGrid data={optionsMockData3} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Grain Direction"}>
        <ProductOptionsGrid data={optionsMockData4} />
      </ConfiguratorAccordion>
    </div>
  );
};
