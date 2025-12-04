import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";
import s from "./CabinetBuilderPage.module.scss";
import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { useState } from "react";

const optionsMockData = [
  {
    id: 1,
    title: "Sink Base",
    desc: "Cabinet with a basin",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "Sink Cabinet",
    desc: "Cabinet without a basin",
    isShortDesc: false,
  },
  {
    id: 3,
    title: "Open Shelf",
    isShortDesc: false,
  },
  {
    id: 4,
    title: "Side Shelf",
    isShortDesc: false,
  },
];

export const CabinetBuilderPage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("instractions"));

  const handleClose = () => {
    sessionStorage.setItem("instractions", "1");
    setIsOpenedBuildInfo(false);
  };
  return (
    <div className={s.cabinetBuilder}>
      {isOpenedBuildInfo && <InstructionPopup handleClose={handleClose} />}

      <ConfiguratorAccordion title={"Cabinet Color"} defaultOpen>
        <ProductOptionsGrid data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Cabinet Style"} defaultOpen>
        <ProductOptionsGrid data={[]} />
      </ConfiguratorAccordion>
    </div>
  );
};
