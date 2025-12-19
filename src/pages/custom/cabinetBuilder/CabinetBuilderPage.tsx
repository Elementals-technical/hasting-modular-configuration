import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ProductOptionsGrid } from "@/entities/product/ui/ProductOptionsGrid/ProductOptionsGrid";
import { ProductStyleGrid } from "@/entities/product/ui/ProductStyleGrid/ProductStyleGrid";

import { ConfiguratorAccordionGroup, ConfiguratorAccordionItem } from "@/shared/ui/Accordion/ConfiguratorAccordion";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { InstructionPopup } from "@/shared/ui/Popups/ui/InstructionPopup/InstructionPopup";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";

import { RightCabinetStyleSidebar } from "@/features/sidebar/ui/RightCabinetStyleSidebar/RightCabinetStyleSidebar";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";

import { addProduct, type addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import {
  addProductId,
  resetProducts,
  setActiveBasinStyle,
  setActiveCabinetType,
  setSelectedProductConfig,
  setDrawerProduct,
} from "@/entities/product/model/store/slice";

import {
  getActiveCabinetType,
  getSelectedProducts,
  getDrawerProduct,
  getDimensionOptions,
} from "@/entities/product/model/store/selectors";
import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";

import { optionsMockData, optionsMockData2 } from "./constants";
import s from "./CabinetBuilderPage.module.scss";
import { useSearchParams } from "react-router-dom";

type AccordionConfig = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
};

const CABINET_TYPE_ID = "cabinet-type";
const CABINET_STYLE_ID = "cabinet-style";
const defaultValue = CABINET_TYPE_ID;

export const CabinetBuilderPage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("instractions"));
  const [accordionValue, setAccordionValue] = useState(defaultValue);
  const [activeStyleId, setActiveStyleId] = useState<number | null>(null);

  const bootstrappedRef = useRef(false);

  const dispatch = useAppDispatch();
  const canvasReady = usePlayCanvasReady();

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const drawerProduct = useAppSelector(getDrawerProduct);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const isStyleSidebarOpen = useAppSelector(getIsActiveStyleSidebar);
  const isStyleDrawerActive = Boolean(drawerProduct) && isStyleSidebarOpen;

  const hasActiveCabinet = Boolean(activeCabinetType);
  const hasProducts = selectedProducts.length > 0;

  const drawerOptionMap = new Map(dimensionOptions.drawers.map((option) => [String(option.value), option]));

  const cabinetStyleOptions = optionsMockData2.map((option) => {
    const ruleOption = option.value ? drawerOptionMap.get(option.value) : undefined;

    return {
      ...option,
      isAvailable: ruleOption ? !ruleOption.disabled : option.isAvailable,
    };
  });

  const handleClose = () => {
    sessionStorage.setItem("instractions", "1");
    setIsOpenedBuildInfo(false);
  };

  const handleSelectCabinetConfig = useCallback(
    (name?: string, config?: addProductConfigI) => {
      if (!name) return;

      dispatch(setDrawerProduct(name));
      dispatch(setSelectedProductConfig(config ?? null));

      if (config?.sinkType) {
        dispatch(setActiveBasinStyle(config.sinkType));
      }
    },
    [dispatch],
  );

  const handleOpenStyleSidebar = () => {
    dispatch(setOpenStyleSidebar(true));
  };

  const setActiveCabinet = (id: number) => {
    dispatch(setActiveCabinetType(id));
    setAccordionValue(CABINET_STYLE_ID);
  };

  useEffect(() => {
    if (!canvasReady || hasProducts || hasActiveCabinet || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    async function resetAndBootstrapFirstProduct() {
      try {
        removeAllProducts();
        dispatch(resetProducts());

        const firstCabinetOption = optionsMockData[0];

        const defaultProductName = "Sink-Base";
        const defaultProductConfig: addProductConfigI = {
          Height: 56,
          Depth: 46,
          CabinetColor: "Ardesia DD GL",
          Width: 60,
          sinkType: "Top_HPLPrisma",
          CountertopColor: "Rosso Rubino 19 MT",
          HandleGrooveColor: "Blu Pavone A6 MT",
        };

        if (firstCabinetOption) {
          dispatch(setActiveCabinetType(firstCabinetOption.id));

          const productId = await addProduct(defaultProductName, defaultProductConfig);
          handleSelectCabinetConfig(defaultProductName, defaultProductConfig);

          if (productId) {
            dispatch(addProductId(productId));
          }
        }
      } catch (error) {
        console.log(error);
      }
    }

    resetAndBootstrapFirstProduct();
  }, [canvasReady, dispatch, handleSelectCabinetConfig, hasActiveCabinet, hasProducts]);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const target = searchParams.get("accordion");
    if (target) setAccordionValue(target);
  }, [searchParams]);

  const accordions: AccordionConfig[] = [
    {
      id: CABINET_TYPE_ID,
      title: "Cabinet Type",
      defaultOpen: true,
      content: (
        <ProductOptionsGrid
          handleAdd={handleSelectCabinetConfig}
          data={optionsMockData}
          setActiveCabinet={setActiveCabinet}
        />
      ),
    },
    {
      id: CABINET_STYLE_ID,
      title: "Cabinet Style",
      content: (
        <ProductStyleGrid
          handleOpenStyleSidebar={handleOpenStyleSidebar}
          data={cabinetStyleOptions}
          requiresActiveCabinet
          isActive={isStyleDrawerActive}
          activeStyleId={activeStyleId}
          onSelectStyle={setActiveStyleId}
        />
      ),
    },
  ];

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
