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
  reset,
  resetProducts,
  setActiveBasinStyle,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
  setDrawerProduct,
} from "@/entities/product/model/store/slice";

import {
  getActiveCabinetType,
  getCabinetColor,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getSelectedProducts,
  getDrawerProduct,
  getDimensionOptions,
  getSelectedProductConfig,
  getSelectedDimensions,
  getSinkType,
  getProductsPresets,
} from "@/entities/product/model/store/selectors";
import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";

import { optionsMockData, optionsMockData2 } from "./constants";
import s from "./CabinetBuilderPage.module.scss";
import { useLocation, useSearchParams } from "react-router-dom";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { typeCabinetCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";

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
  const hasBootstrappedOnceRef = useRef(false);

  const dispatch = useAppDispatch();
  const canvasReady = usePlayCanvasReady();

  const { pathname } = useLocation();

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const drawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const sinkType = useAppSelector(getSinkType);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const isStyleSidebarOpen = useAppSelector(getIsActiveStyleSidebar);
  const isStyleDrawerActive = Boolean(drawerProduct) && isStyleSidebarOpen;
  const productsPresets = useAppSelector(getProductsPresets);

  console.log("selectedProductConfig", selectedProductConfig);

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

  const mapDrawerValueToConfig = (value?: string) => {
    if (value === "1") return "1D";
    if (value === "2") return "2D";
    if (value === "1+inner") return "1DWID";
    return undefined;
  };

  const handleSelectDrawerStyle = (id: number) => {
    setActiveStyleId(id);

    const option = optionsMockData2.find((item) => item.id === id);
    const mappedValue = mapDrawerValueToConfig(option?.value);

    if (mappedValue) {
      dispatch(
        setSelectedProductConfig({
          ...(selectedProductConfig ?? {}),
          Drawers: mappedValue,
        }),
      );
    }
  };

  const setActiveCabinet = (id: number, name?: string) => {
    console.log("name", name);

    dispatch(setActiveCabinetType(id));
    setAccordionValue(CABINET_STYLE_ID);

    if (name === "Open-Shelf" || name === "Side-Shelf") {
      dispatch(setOpenStyleSidebar(true));
    }
  };

  const resolveCabinetTypeId = useCallback((productType?: string | null) => {
    if (!productType) return null;

    const normalized = productType.toLowerCase();
    const match = typeCabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));

    return match?.id ?? null;
  }, []);

  useEffect(() => {
    if (!pathname.includes("/custom/cabinet-builder")) return;
    if (productsPresets.length) return;

    bootstrappedRef.current = false;
    if (hasBootstrappedOnceRef.current) return;
    dispatch(reset());

    if (canvasReady) {
      removeAllProducts();
    }
  }, [canvasReady, dispatch, pathname, productsPresets.length]);

  useEffect(() => {
    if (!canvasReady || !productsPresets.length || bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    hasBootstrappedOnceRef.current = true;

    const run = async () => {
      dispatch(resetProducts());

      const existingIds = getOrderedProductIds();

      if (!existingIds.length) {
        const mergedPresets = productsPresets.map((preset) => ({
          ...preset,
          CabinetColor: preset.CabinetColor ?? cabinetColor,
          sinkType: preset.sinkType ?? sinkType,
          CountertopColor: preset.CountertopColor ?? countertopColor,
          HandleGrooveColor: preset.HandleGrooveColor ?? handleGrooveColor,
        }));

        removeAllProducts();
        await addPreset(mergedPresets);
      } else {
        setConfigBatch(existingIds, {
          CabinetColor: cabinetColor,
          sinkType,
          CountertopColor: countertopColor,
          HandleGrooveColor: handleGrooveColor,
        });
      }

      const orderedIds = existingIds.length ? existingIds : getOrderedProductIds();
      orderedIds.forEach((id) => dispatch(addProductId(id)));

      const [firstPreset] = productsPresets;
      if (firstPreset?.name) {
        dispatch(setDrawerProduct(firstPreset.name));
      }

      dispatch(setSelectedProductConfig(firstPreset ?? null));

      const nextDimensions: Partial<typeof selectedDimensions> = {};
      if (typeof firstPreset?.Width === "number") nextDimensions.width = firstPreset.Width;
      if (typeof firstPreset?.Height === "number") nextDimensions.height = firstPreset.Height;
      if (typeof firstPreset?.Depth === "number") nextDimensions.depth = firstPreset.Depth;

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }

      const cabinetTypeId = resolveCabinetTypeId(firstPreset?.name);
      if (cabinetTypeId !== null) {
        dispatch(setActiveCabinetType(cabinetTypeId));
      }
    };

    run();
  }, [canvasReady, dispatch, productsPresets, resolveCabinetTypeId, selectedDimensions]);

  useEffect(() => {
    if (!canvasReady || hasProducts || hasActiveCabinet || bootstrappedRef.current) return;
    if (hasBootstrappedOnceRef.current) return;

    bootstrappedRef.current = true;

    async function resetAndBootstrapFirstProduct() {
      try {
        removeAllProducts();
        dispatch(resetProducts());

        const firstCabinetOption = optionsMockData[0];

        const defaultProductName = "Sink-Base";
        const defaultProductConfig: addProductConfigI = {
          Height: selectedDimensions.height,
          Depth: selectedDimensions.depth,
          Width: selectedDimensions.width,
          CabinetColor: cabinetColor,
          sinkType,
          CountertopColor: countertopColor,
          HandleGrooveColor: handleGrooveColor,
          ...(selectedProductConfig ?? {}),
        };

        if (firstCabinetOption) {
          dispatch(setActiveCabinetType(firstCabinetOption.id));

          const productId = await addProduct(defaultProductName, defaultProductConfig);
          handleSelectCabinetConfig(defaultProductName, defaultProductConfig);

          if (productId) {
            dispatch(addProductId(productId));
          }
        }

        hasBootstrappedOnceRef.current = true;
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
      content: (() => {
        const activeCabinet = optionsMockData.find((option) => option.id === activeCabinetType);
        const drawersBlocked = activeCabinet?.name === "Open-Shelf" || activeCabinet?.name === "Side-Shelf";

        if (drawersBlocked) {
          return <div className={s.message}>Drawers are not available for this cabinet type.</div>;
        }

        return (
          <ProductStyleGrid
            handleOpenStyleSidebar={handleOpenStyleSidebar}
            data={cabinetStyleOptions}
            requiresActiveCabinet
            isActive={isStyleDrawerActive}
            activeStyleId={activeStyleId}
            onSelectStyle={handleSelectDrawerStyle}
          />
        );
      })(),
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
