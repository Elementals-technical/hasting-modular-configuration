import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";
import { ConfiguratorAccordion } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { useEffect, useState } from "react";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { addProduct } from "@/utils/functions/playcanvas/addProduct";
import { addProductId } from "@/entities/product/model/store/slice";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";

import s from "./CabinetBuilderPage.module.scss";
import { ProductStyleGrid } from "@/entities/product/ui/ProductStyleGrid/ProductStyleGrid";

const optionsMockData = [
  {
    id: 1,
    title: "Sink Base",
    name: "CabinetUniBox",
    desc: "Cabinet with a basin",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "Sink Cabinet",
    name: "UniOpenShelves",
    desc: "Cabinet without a basin",
    isShortDesc: false,
  },
  {
    id: 3,
    title: "Open Shelf",
    name: "CabinetUniBox",
    isShortDesc: false,
  },
  {
    id: 4,
    title: "Side Shelf",
    isShortDesc: false,
  },
];

const optionsMockData2 = [
  {
    id: 1,
    title: "1 Drawer",
    isShortDesc: false,
  },
  {
    id: 2,
    title: "2 Drawer",
    isShortDesc: false,
  },
];

export const CabinetBuilderPage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("instractions"));

  const dispatch = useAppDispatch();

  const handleClose = () => {
    sessionStorage.setItem("instractions", "1");
    setIsOpenedBuildInfo(false);
  };

  const handleAddProduct = async (name?: string) => {
    if (!name) return;

    try {
      const productId = await addProduct(name);

      if (productId) {
        dispatch(addProductId(productId));
      }
    } catch (error) {
      console.error("[ProductModelItem] Failed to apply preset", error);
    }
  };

  useEffect(() => {
    async function removePrebuiltProducts() {
      try {
        await removeAllProducts();
      } catch (error) {
        console.log(error);
      }
    }

    removePrebuiltProducts();
  }, []);

  return (
    <div className={s.cabinetBuilder}>
      {isOpenedBuildInfo && <InstructionPopup handleClose={handleClose} />}

      <ConfiguratorAccordion title={"Cabinet Type"} defaultOpen>
        <ProductOptionsGrid handleAdd={handleAddProduct} data={optionsMockData} />
      </ConfiguratorAccordion>

      <ConfiguratorAccordion title={"Cabinet Style"} defaultOpen>
        <ProductStyleGrid data={optionsMockData2} requiresActiveCabinet />
      </ConfiguratorAccordion>

      {/* <RightCabinetStyleSidebar /> */}
    </div>
  );
};
