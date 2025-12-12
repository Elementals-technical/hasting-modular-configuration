import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductStyleGrid } from "@/entities/product/ui/ProductStyleGrid/ProductStyleGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { RightCabinetStyleSidebar } from "@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { addProduct } from "@/utils/functions/playcanvas/addProduct";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import {
  addProductId,
  resetProducts,
  setActiveCabinetType,
  setDrawerProduct,
} from "@/entities/product/model/store/slice";

import { getActiveCabinetType, getSelectedProducts } from "@/entities/product/model/store/selectors";

import { optionsMockData, optionsMockData2 } from "./constants";
import s from "./CabinetBuilderPage.module.scss";
import { useSearchParams } from "react-router-dom";

type AccordionConfig = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
};

export const CabinetBuilderPage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("instractions"));
  const bootstrappedRef = useRef(false);

  const dispatch = useAppDispatch();
  const canvasReady = usePlayCanvasReady();

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const hasActiveCabinet = Boolean(activeCabinetType);
  const hasProducts = selectedProducts.length > 0;

  const handleClose = () => {
    sessionStorage.setItem("instractions", "1");
    setIsOpenedBuildInfo(false);
  };

  const handleAddProduct = useCallback(
    async (name?: string) => {
      if (!name) return;

      try {
        const productId = await addProduct(name);

        if (productId) {
          dispatch(addProductId(productId));
        }
      } catch (error) {
        console.error("[ProductModelItem] Failed to apply preset", error);
      }
    },
    [dispatch],
  );

  const handleOpenStyleSidebar = () => {
    dispatch(setOpenStyleSidebar(true));
  };

  useEffect(() => {
    if (!canvasReady || hasProducts || hasActiveCabinet || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    async function resetAndBootstrapFirstProduct() {
      try {
        removeAllProducts();
        dispatch(resetProducts());

        const firstCabinetOption = optionsMockData[0];

        if (firstCabinetOption) {
          dispatch(setActiveCabinetType(firstCabinetOption.id));
          await handleAddProduct(firstCabinetOption.name);

          if (firstCabinetOption.name) {
            dispatch(setDrawerProduct(firstCabinetOption.name));
          }
        }
      } catch (error) {
        console.log(error);
      }
    }

    resetAndBootstrapFirstProduct();
  }, [canvasReady, dispatch, handleAddProduct, hasActiveCabinet, hasProducts]);

  const setActiveCabinet = (id: number) => {
    console.log(id);

    removeAllProducts();
    dispatch(resetProducts());

    dispatch(setActiveCabinetType(id));
  };

  const accordions: AccordionConfig[] = [
    {
      id: "cabinet-type",
      title: "Cabinet Type",
      defaultOpen: true,
      content: (
        <ProductOptionsGrid handleAdd={handleAddProduct} data={optionsMockData} setActiveCabinet={setActiveCabinet} />
      ),
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

  const [searchParams] = useSearchParams();
  const [accordionValue, setAccordionValue] = useState(defaultValue);

  useEffect(() => {
    const target = searchParams.get("accordion");
    if (target) setAccordionValue(target);
  }, [searchParams]);

  return (
    <div className={s.cabinetBuilder}>
      {isOpenedBuildInfo && <InstructionPopup handleClose={handleClose} />}

      <ConfiguratorAccordionGroup defaultValue={defaultValue} value={accordionValue} onValueChange={setAccordionValue}>
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
