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
  setActiveCountertopColor,
  setActiveCountertopThickness,
  setCabinetColor,
  setCountertopStyle,
  setDividersOption,
  setDividersStyle,
  setDrawerPanelFluting,
  setFaucetHolesAmount,
  setFaucetHolesSpacing,
  setGrainDirection,
  setHasBootstrappedCabinetBuilder,
  setHandleGrooveColor,
  setLedOption,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSidePanelsOption,
  setTowelBarColor,
  setTowelBarOption,
  setDrawerProduct,
  addProductPreset,
  setCabinetCatalog,
} from "@/entities/product/model/store/slice";

import {
  getActiveCabinetType,
  getActiveCabinetRule,
  getCabinetCatalog,
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
import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";

import { getIsActiveStyleSidebar } from "@/features/sidebar/model/store/selectors";

import { cabinetTypeMetadataByCode, optionsMockData2 } from "./constants";
import s from "./CabinetBuilderPage.module.scss";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { useLazyRestoreConfigurationQuery } from "@/entities";
import { buildPresetFromConfiguration } from "@/utils/buildPresetFromConfiguration";
import { useGetProductDatatableQuery } from "@/entities/product/api";

type AccordionConfig = {
  id: string;
  title: string;
  content: ReactNode;
  defaultOpen?: boolean;
};

const CABINET_TYPE_ID = "cabinet-type";
const CABINET_STYLE_ID = "cabinet-style";
const defaultValue = CABINET_TYPE_ID;
const MATRIX_CABINET_DATATABLE_ID = 439;

export const CabinetBuilderPage = () => {
  const [isOpenedBuildInfo, setIsOpenedBuildInfo] = useState(() => !sessionStorage.getItem("instractions"));
  const [accordionValue, setAccordionValue] = useState(defaultValue);
  const [activeStyleId, setActiveStyleId] = useState<number | null>(null);

  const bootstrappedRef = useRef(false);

  const dispatch = useAppDispatch();
  const canvasReady = usePlayCanvasReady();

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configId = searchParams.get("configId");
  const [restoreConfiguration] = useLazyRestoreConfigurationQuery();

  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const drawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetCatalog = useAppSelector(getCabinetCatalog);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const sinkType = useAppSelector(getSinkType);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const isStyleSidebarOpen = useAppSelector(getIsActiveStyleSidebar);
  const isStyleDrawerActive = Boolean(drawerProduct) && isStyleSidebarOpen;
  const productsPresets = useAppSelector(getProductsPresets);
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);

  const {
    data: matrixCabinetTable,
    isLoading: isMatrixLoading,
    isError: isMatrixError,
  } = useGetProductDatatableQuery(MATRIX_CABINET_DATATABLE_ID);

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
      cabinetCatalog.typeCabinetRules.map((rule) => {
        const meta = cabinetTypeMetadataByCode[rule.code] ?? {};

        return {
          id: rule.id,
          title: meta.title ?? rule.code.replace(/-/g, " "),
          name: rule.code,
          desc: meta.desc,
          isShortDesc: meta.isShortDesc ?? false,
          metadata: {
            image: resolveCabinetTypeImage(rule.code, selectedDimensions.height, meta.image),
          },
        };
      }),
    [cabinetCatalog.typeCabinetRules, selectedDimensions.height],
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

    const isOpen = cabinetCatalog.typeCabinetRules.find((rule) => rule.id === id)?.isOpen;
    if (isOpen) {
      dispatch(setOpenStyleSidebar(true));
    }
  };

  const resolveCabinetTypeId = useCallback(
    (productType?: string | null) => {
      if (!productType) return null;

      const normalized = productType.toLowerCase();
      const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));

      return match?.id ?? null;
    },
    [cabinetCatalog.typeCabinetRules],
  );

  useEffect(() => {
    if (!matrixCabinetTable) return;
    const catalog = buildCabinetCatalogFromMatrix(matrixCabinetTable);
    console.log(
      "[CabinetBuilder] matrix rows",
      matrixCabinetTable.rows?.length,
      "rules",
      catalog.typeCabinetRules.length,
    );
    if (catalog.typeCabinetRules.length) {
      dispatch(setCabinetCatalog(catalog));
    }
  }, [dispatch, matrixCabinetTable]);

  useEffect(() => {
    if (!pathname.includes("/custom/cabinet-builder")) return;
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

  const handleRestoreConfiguration = useCallback(
    async (id: string | number) => {
      try {
        const result = await restoreConfiguration(id).unwrap();

        const path = result?.metadata?.path;
        if (typeof path === "string" && path.startsWith("/")) {
          navigate(path);
        }

        const configuration = result?.configuration || {};

        const orderedIdsFromMeta = result?.metadata?.orderedProductIds;
        const sourceIds = Array.isArray(orderedIdsFromMeta)
          ? orderedIdsFromMeta.filter((id) => typeof id === "string")
          : [];

        const isTopConfig = (id: string, value: unknown) => {
          if (!value || typeof value !== "object") return false;

          const record = value as Record<string, unknown>;
          const name =
            (typeof record.productType === "string" && record.productType) ||
            (typeof record.entityName === "string" && record.entityName) ||
            id;

          return name.startsWith("Top_");
        };

        const configIdsRaw = sourceIds.length ? sourceIds : Object.keys(configuration);
        const productConfigIds = configIdsRaw.filter((id) => !isTopConfig(id, configuration[id]));
        const topConfigIds = configIdsRaw.filter((id) => isTopConfig(id, configuration[id]));

        const uiState = result?.metadata?.uiState;
        const uiStateValues = uiState && typeof uiState === "object" ? (uiState as Record<string, unknown>) : null;

        const presetProducts = buildPresetFromConfiguration(configuration, productConfigIds);

        dispatch(resetProducts());
        removeAllProducts();

        const createdIds = await addPreset(presetProducts);
        dispatch(addProductPreset(presetProducts));

        // @ts-ignore
        const orderedIds = Array.isArray(createdIds) && createdIds.length ? createdIds : getOrderedProductIds();
        orderedIds.forEach((productId) => dispatch(addProductId(productId)));

        const configIds = productConfigIds;
        let sidePanelValue: string | undefined;
        let towelBarValue: string | undefined;
        let towelBarSideValue: string | undefined;
        let towelBarColorValue: string | undefined;

        for (let i = 0; i < orderedIds.length; i += 1) {
          const sourceId = configIds[i];
          const configValue = sourceId ? configuration[sourceId] : null;

          if (configValue && typeof configValue === "object") {
            const cfg = configValue as Record<string, unknown>;

            if (!sidePanelValue && typeof cfg.SidePanel === "string") {
              sidePanelValue = cfg.SidePanel;
            }
            if (!sidePanelValue && typeof cfg.SidePanels === "string") {
              sidePanelValue = cfg.SidePanels;
            }
            if (!towelBarValue && typeof cfg.TowelBarOption === "string") {
              towelBarValue = cfg.TowelBarOption;
            }
            if (!towelBarValue && typeof cfg.TowelBar === "string") {
              towelBarValue = cfg.TowelBar;
            }
            if (!towelBarSideValue && typeof cfg.TowelBarSide === "string") {
              towelBarSideValue = cfg.TowelBarSide;
            }
            if (!towelBarColorValue && typeof cfg.TowelBarColor === "string") {
              towelBarColorValue = cfg.TowelBarColor;
            }

            await setConfig(orderedIds[i], configValue);
          }
        }

        for (const topId of topConfigIds) {
          const configValue = configuration[topId];

          if (!configValue || typeof configValue !== "object") continue;

          const record = configValue as Record<string, unknown>;
          const name =
            (typeof record.productType === "string" && record.productType) ||
            (typeof record.entityName === "string" && record.entityName) ||
            topId;

          if (name.startsWith("Top_")) {
            await setConfigBatch({ productType: name }, configValue);
          }
        }

        const uiCabinetColor =
          typeof uiStateValues?.CabinetColor === "string" ? (uiStateValues.CabinetColor as string) : undefined;
        const uiHandleGrooveColor =
          typeof uiStateValues?.HandleGrooveColor === "string"
            ? (uiStateValues.HandleGrooveColor as string)
            : undefined;
        const uiSinkType = typeof uiStateValues?.sinkType === "string" ? (uiStateValues.sinkType as string) : undefined;
        const uiCountertopColor =
          typeof uiStateValues?.CountertopColor === "string" ? (uiStateValues.CountertopColor as string) : undefined;
        const uiCountertopThickness =
          typeof uiStateValues?.Thickness === "string" ? (uiStateValues.Thickness as string) : undefined;
        const uiDrawerPanelFluting =
          typeof uiStateValues?.DrawerPanelFluting === "string"
            ? (uiStateValues.DrawerPanelFluting as string)
            : undefined;
        const uiGrainDirection =
          typeof uiStateValues?.GrainDirection === "string" ? (uiStateValues.GrainDirection as string) : undefined;
        const uiCountertopStyle =
          typeof uiStateValues?.CountertopStyle === "string" ? (uiStateValues.CountertopStyle as string) : undefined;
        const uiSidePanels =
          typeof uiStateValues?.SidePanels === "string" ? (uiStateValues.SidePanels as string) : undefined;
        const uiLedOption =
          typeof uiStateValues?.LedOption === "string" ? (uiStateValues.LedOption as string) : undefined;
        const uiDividersOption =
          typeof uiStateValues?.DividersOption === "string" ? (uiStateValues.DividersOption as string) : undefined;
        const uiDividersStyle =
          typeof uiStateValues?.DividersStyle === "string" ? (uiStateValues.DividersStyle as string) : undefined;
        const uiTowelBarOption =
          typeof uiStateValues?.TowelBarOption === "string" ? (uiStateValues.TowelBarOption as string) : undefined;
        const uiTowelBarColor =
          typeof uiStateValues?.TowelBarColor === "string" ? (uiStateValues.TowelBarColor as string) : undefined;
        const uiTowelBarSide =
          typeof uiStateValues?.["TowelBarSide"] === "string" ? (uiStateValues["TowelBarSide"] as string) : undefined;
        const uiFaucetHolesAmount =
          typeof uiStateValues?.FaucetHolesAmount === "string"
            ? (uiStateValues.FaucetHolesAmount as string)
            : undefined;
        const uiFaucetHolesSpacing =
          typeof uiStateValues?.FaucetHolesSpacing === "string"
            ? (uiStateValues.FaucetHolesSpacing as string)
            : undefined;

        const batchConfig: Record<string, unknown> = {};
        if (uiCabinetColor) batchConfig.CabinetColor = uiCabinetColor;
        if (uiHandleGrooveColor) batchConfig.HandleGrooveColor = uiHandleGrooveColor;
        if (uiSinkType) batchConfig.sinkType = uiSinkType;
        if (uiCountertopColor) batchConfig.CountertopColor = uiCountertopColor;
        if (uiCountertopThickness) batchConfig.Thickness = uiCountertopThickness;

        if (Object.keys(batchConfig).length) {
          await setConfigBatch(orderedIds, batchConfig);
        }

        if (uiSidePanels || sidePanelValue) {
          const sidePanel = uiSidePanels || sidePanelValue;
          if (sidePanel) {
            await setConfigBatch({ productType: "SidePanel" }, { SidePanel: sidePanel });
            dispatch(setSidePanelsOption(sidePanel));
          }
        }

        const towelBarOption = uiTowelBarOption || towelBarValue;
        const towelBarSide = uiTowelBarSide || towelBarSideValue;
        if (typeof towelBarOption === "string") {
          const isNone = towelBarOption === "None";
          const side = typeof towelBarSide === "string" && towelBarSide ? towelBarSide : towelBarOption.toLowerCase();
          await setConfigBatch(
            {},
            {
              TowelBar: isNone ? "None" : "TowelBar40_R",
              TowelBarSide: isNone ? "both" : side,
            },
          );

          dispatch(setTowelBarOption(towelBarOption));
          if (isNone) {
            dispatch(setTowelBarColor(""));
          }
        }

        const towelColor = uiTowelBarColor || towelBarColorValue;
        if (towelColor) {
          await setConfigBatch({}, { TowelBarColor: towelColor });
          dispatch(setTowelBarColor(towelColor));
        }

        if (uiCabinetColor) dispatch(setCabinetColor(uiCabinetColor));
        if (uiHandleGrooveColor) dispatch(setHandleGrooveColor(uiHandleGrooveColor));
        if (uiSinkType) dispatch(setActiveBasinStyle(uiSinkType));
        if (uiCountertopColor) dispatch(setActiveCountertopColor(uiCountertopColor));
        if (uiCountertopThickness) dispatch(setActiveCountertopThickness(uiCountertopThickness));
        if (uiDrawerPanelFluting) dispatch(setDrawerPanelFluting(uiDrawerPanelFluting));
        if (uiGrainDirection) dispatch(setGrainDirection(uiGrainDirection));
        if (uiCountertopStyle) dispatch(setCountertopStyle(uiCountertopStyle));
        if (uiLedOption) dispatch(setLedOption(uiLedOption));
        if (uiDividersOption) dispatch(setDividersOption(uiDividersOption));
        if (uiDividersStyle) dispatch(setDividersStyle(uiDividersStyle));
        if (uiFaucetHolesAmount) dispatch(setFaucetHolesAmount(uiFaucetHolesAmount));
        if (uiFaucetHolesSpacing) dispatch(setFaucetHolesSpacing(uiFaucetHolesSpacing));

        const [firstPreset] = presetProducts;
        if (firstPreset?.name) {
          dispatch(setDrawerProduct(firstPreset.name));
        }

        dispatch(setSelectedProductConfig(firstPreset ?? null));

        console.log("config firstPreset", firstPreset);

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
    },
    [dispatch, navigate, resolveCabinetTypeId, restoreConfiguration],
  );

  useEffect(() => {
    if (!canvasReady || !configId || bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    dispatch(setHasBootstrappedCabinetBuilder(true));

    handleRestoreConfiguration(configId);
  }, [canvasReady, configId, dispatch, handleRestoreConfiguration]);

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

    const selectedCabinetRule = cabinetCatalog.typeCabinetRules.find((rule) => rule.id === activeCabinetType);
    if (!selectedCabinetRule) return;

    // For Open-Shelf and Side-Shelf, add product immediately when cabinet type is selected
    // For other types, wait for drawer style to be selected
    if (!selectedCabinetRule.isOpen && !activeStyleId) return;

    // Capture values for async function
    const productName = selectedCabinetRule.code || "Sink-Base";
    const cabinetConfig: addProductConfigI = {};
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
        if (selectedCabinetRule.hasSink && sinkType) {
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
    cabinetCatalog.typeCabinetRules,
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
        const drawersBlocked = Boolean(activeCabinetRule?.isOpen) || dimensionOptions.drawers.length === 0;

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
    <>
      <div className={s.cabinetBuilder}>
        {isOpenedBuildInfo && <InstructionPopup handleClose={handleClose} />}

        {isMatrixLoading ? (
          <div>Loading cabinet rules...</div>
        ) : isMatrixError || cabinetCatalog.typeCabinetRules.length === 0 ? (
          <div>Cabinet rules are unavailable. Matrix rows: {matrixCabinetTable?.rows?.length ?? 0}</div>
        ) : (
          <ConfiguratorAccordionGroup
            defaultValue={defaultValue}
            value={accordionValue}
            onValueChange={setAccordionValue}
          >
            {accordions.map(({ id, title, content }) => (
              <ConfiguratorAccordionItem key={id} value={id} title={title}>
                {content}
              </ConfiguratorAccordionItem>
            ))}
          </ConfiguratorAccordionGroup>
        )}

        <RightCabinetStyleSidebar onProductAdded={handleResetToDefaultState} />
      </div>
    </>
  );
};
