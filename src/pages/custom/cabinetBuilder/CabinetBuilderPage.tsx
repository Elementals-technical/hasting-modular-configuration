import { useEffect, useState, type ReactNode } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductStyleGrid } from "@/entities/product/ui/ProductStyleGrid/ProductStyleGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";

import { RightCabinetStyleSidebar } from "@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { addProduct } from "@/utils/functions/playcanvas/addProduct";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import { addProductId } from "@/entities/product/model/store/slice";

import { optionsMockData, optionsMockData2 } from "./constants";
import s from "./CabinetBuilderPage.module.scss";

type AccordionConfig = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
};

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

  const handleOpenStyleSidebar = () => {
    dispatch(setOpenStyleSidebar(true));
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

  const accordions: AccordionConfig[] = [
    {
      id: "cabinet-type",
      title: "Cabinet Type",
      defaultOpen: true,
      content: <ProductOptionsGrid handleAdd={handleAddProduct} data={optionsMockData} />,
    },
    {
      id: "cabinet-style",
      title: "Cabinet Style",
      content: (
        <ProductStyleGrid
          handleOpenStyleSidebar={handleOpenStyleSidebar}
          data={optionsMockData2}
          requiresActiveCabinet
        />
      ),
    },
  ];

  const defaultValue = accordions.find((accordion) => accordion.defaultOpen)?.id;

  return (
    <div className={s.cabinetBuilder}>
      {isOpenedBuildInfo && <InstructionPopup handleClose={handleClose} />}

      <ConfiguratorAccordionGroup defaultValue={defaultValue}>
        {accordions.map(({ id, title, content }) => (
          <ConfiguratorAccordionItem key={id} value={id} title={title}>
            {content}
          </ConfiguratorAccordionItem>
        ))}
      </ConfiguratorAccordionGroup>

      <RightCabinetStyleSidebar />
    </div>
  );
};
