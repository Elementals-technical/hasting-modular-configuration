import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  resetCabinetBuilderBootstrap,
  resetProducts,
  setActiveBasinStyle,
  setActiveCabinetType,
  setHasBootstrappedCabinetBuilder,
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
  getHasBootstrappedCabinetBuilder,
} from "@/entities/product/model/store/selectors";
import { resolveCabinetTypeImage, resolveCabinetStyleImage } from "@/entities/product/lib/resolveCabinetImages";

import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";

import { optionsMockData, optionsMockData2 } from "./constants";
import s from "./CabinetBuilderPage.module.scss";
import { useLocation, useSearchParams } from "react-router-dom";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { typeCabinetCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { useLazyRestoreConfigurationQuery } from "@/entities";
import { buildPresetFromConfiguration } from "@/utils/buildPresetFromConfiguration";
import type { PresetProduct } from "@/entities/product/types";

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

  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const configId = searchParams.get("configId");
  const [restoreConfiguration] = useLazyRestoreConfigurationQuery();

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
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);

  console.log("selectedProductConfig", selectedProductConfig);

  const hasProducts = selectedProducts.length > 0;

  const cabinetStyleOptions = useMemo(() => {
    const drawerOptionMap = new Map(dimensionOptions.drawers.map((option) => [String(option.value), option]));

    return optionsMockData2.map((option) => {
      const ruleOption = option.value ? drawerOptionMap.get(option.value) : undefined;

      return {
        ...option,
        isAvailable: ruleOption ? !ruleOption.disabled : option.isAvailable,
        metadata: {
          ...option.metadata,
          image: resolveCabinetStyleImage(option.value, selectedDimensions.height, option.metadata?.image),
        },
      };
    });
  }, [selectedDimensions.height, dimensionOptions.drawers]);

  const cabinetTypeOptions = useMemo(
    () =>
      optionsMockData.map((option) => ({
        ...option,
        metadata: {
          ...option.metadata,
          image: resolveCabinetTypeImage(option.name, selectedDimensions.height, option.metadata?.image),
        },
      })),
    [selectedDimensions.height],
  );

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
    if (configId) return;
    if (productsPresets.length) return;
    if (hasBootstrappedCabinetBuilder) return;

    bootstrappedRef.current = false;
    dispatch(reset());
    dispatch(resetCabinetBuilderBootstrap());

    if (canvasReady) {
      removeAllProducts();
    }
  }, [canvasReady, dispatch, hasBootstrappedCabinetBuilder, pathname, productsPresets.length]);

  useEffect(() => {
    if (!canvasReady || !productsPresets.length || bootstrappedRef.current) return;
    if (hasBootstrappedCabinetBuilder) return;
    if (configId) return;

    bootstrappedRef.current = true;
    dispatch(setHasBootstrappedCabinetBuilder(true));

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
  }, [
    canvasReady,
    dispatch,
    hasBootstrappedCabinetBuilder,
    productsPresets,
    resolveCabinetTypeId,
    selectedDimensions,
    cabinetColor,
    countertopColor,
    handleGrooveColor,
    sinkType,
    configId,
  ]);

  useEffect(() => {
    if (!canvasReady || !configId || bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    dispatch(setHasBootstrappedCabinetBuilder(true));

    const run = async () => {
      try {
        const result = await restoreConfiguration(configId).unwrap();
        const configuration = result?.configuration || {};
        const presetProducts = buildPresetFromConfiguration(configuration);

        dispatch(resetProducts());
        removeAllProducts();

        const createdIds = await addPreset(presetProducts);
        dispatch(addProductPreset(presetProducts));

        const orderedIds = Array.isArray(createdIds) && createdIds.length ? createdIds : getOrderedProductIds();
        orderedIds.forEach((id) => dispatch(addProductId(id)));

        const groupByName = presetProducts.reduce<Record<string, PresetProduct[]>>((acc, item) => {
          const key = item.name;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        }, {});

        Object.entries(groupByName).forEach(([name, items]) => {
          const [first] = items;
          if (!first) return;

          if (name.startsWith("Top_")) {
            if (first.CountertopColor) {
              setConfigBatch({ productType: name }, { CountertopColor: first.CountertopColor });
            }
            return;
          }

          const config: Record<string, unknown> = {};
          if (first.CabinetColor) config.CabinetColor = first.CabinetColor;
          if (first.HandleGrooveColor) config.HandleGrooveColor = first.HandleGrooveColor;
          if (first.sinkType) config.sinkType = first.sinkType;
          if (first.Drawers) config.Drawers = first.Drawers;

          if (Object.keys(config).length) {
            setConfigBatch({ productType: name }, config);
          }
        });

        const [firstPreset] = presetProducts;
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
      } catch (error) {
        console.error("[Configurations] Restore failed", error);
      }
    };

    run();
  }, [canvasReady, configId, dispatch, restoreConfiguration, resolveCabinetTypeId, selectedDimensions]);

  const handleResetToDefaultState = useCallback(() => {
    setAccordionValue(CABINET_TYPE_ID);
  }, []);

  // Auto-add product when cabinet type and style are selected and scene is empty
  useEffect(() => {
    if (!pathname.includes("/custom/cabinet-builder")) return;
    // Don't proceed if already bootstrapped, canvas is not ready, or scene already has products
    if (hasBootstrappedCabinetBuilder || !canvasReady || hasProducts) return;
    // Need at least a cabinet type selected
    if (!activeCabinetType) return;

    const selectedCabinetOption = optionsMockData.find((option) => option.id === activeCabinetType);
    if (!selectedCabinetOption) return;

    const isOpenOrSideShelf =
      selectedCabinetOption.name === "Open-Shelf" || selectedCabinetOption.name === "Side-Shelf";

    // For Open-Shelf and Side-Shelf, add product immediately when cabinet type is selected
    // For other types, wait for drawer style to be selected
    if (!isOpenOrSideShelf && !activeStyleId) return;

    // Capture values for async function
    const productName = selectedCabinetOption.name || "Sink-Base";
    const cabinetConfig = selectedCabinetOption.config ?? {};
    const currentSelectedConfig = selectedProductConfig ?? {};

    async function addProductToScene() {
      try {
        // Build product config: start with cabinet option config, then override with selected config and current values
        const productConfig: addProductConfigI = {
          ...cabinetConfig,
          Height: selectedDimensions.height,
          Depth: selectedDimensions.depth,
          Width: selectedDimensions.width,
          CabinetColor: cabinetColor,
          CountertopColor: countertopColor,
          HandleGrooveColor: handleGrooveColor,
          Handle: currentSelectedConfig.Handle || "handle_urban_topcut",
          // ...currentSelectedConfig,
        };

        // Add sinkType if it's a Sink-Base
        if (productName === "Sink-Base" && sinkType) {
          productConfig.sinkType = sinkType;
        }

        const productId = await addProduct(productName, productConfig);

        if (productId) {
          dispatch(addProductId(productId));
          handleSelectCabinetConfig(productName, productConfig);

          // Update dimensions if they were set from the cabinet option
          if (cabinetConfig.Width || cabinetConfig.Height || cabinetConfig.Depth) {
            const nextDimensions: Partial<typeof selectedDimensions> = {};
            if (cabinetConfig.Width) nextDimensions.width = cabinetConfig.Width;
            if (cabinetConfig.Height) nextDimensions.height = cabinetConfig.Height;
            if (cabinetConfig.Depth) nextDimensions.depth = cabinetConfig.Depth;

            if (Object.keys(nextDimensions).length) {
              dispatch(setSelectedDimensions(nextDimensions));
            }
          }

          // Mark as bootstrapped to save configuration when navigating back
          dispatch(setHasBootstrappedCabinetBuilder(true));

          // Close sidebar and reset accordion to default state
          handleResetToDefaultState();
          dispatch(setOpenStyleSidebar(false));
        }
      } catch (error) {
        console.error("Failed to add product to scene:", error);
      }
    }

    addProductToScene();
  }, [
    pathname,
    canvasReady,
    hasProducts,
    hasBootstrappedCabinetBuilder,
    activeCabinetType,
    activeStyleId,
    selectedDimensions,
    cabinetColor,
    countertopColor,
    handleGrooveColor,
    sinkType,
    selectedProductConfig,
    handleSelectCabinetConfig,
    dispatch,
    handleResetToDefaultState,
  ]);

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
          data={cabinetTypeOptions}
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

      <RightCabinetStyleSidebar onProductAdded={handleResetToDefaultState} />
    </div>
  );
};
