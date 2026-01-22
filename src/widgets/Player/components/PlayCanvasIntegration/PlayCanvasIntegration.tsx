import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  addProductId,
  removeProductId,
  setActiveCabinetType,
  setSelectedDimensions,
  setSelectedProductConfig,
  setSelectedSceneProduct,
  swapProductIds,
} from "@/entities/product/model/store/slice";
import { swapProducts } from "@/utils/functions/playcanvas/swapProducts.ts";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight.tsx";
import { getSelectTool } from "@/utils/functions/playcanvas/getSelectTool";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { setProductByParams } from "@/utils/functions/playcanvas/setProductByParams";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import {
  getDimensionOptions,
  getCabinetCatalog,
  getSelectedSceneProduct,
  getSelectedProductConfig,
} from "@/entities/product/model/store/selectors";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getDimensionTool } from "@/utils/functions/playcanvas/getDimensionTool";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { OpenMenuIcon } from "@/shared/assets/images/svg/OpenMenuIcon";
import { DeleteMenuIcon } from "@/shared/assets/images/svg/DeleteMenuIcon";

// 🔧 UPDATE THIS VERSION WHEN DEPLOYING NEW PLAYCANVAS BUILD
const PLAYCANVAS_VERSION = "022";
const PLAYCANVAS_SRC = `/HastingCabinetsParametrization/index.html?v=${PLAYCANVAS_VERSION}`;

export const PlayCanvasIntegration = () => {
  const containerRef = useRef<HTMLIFrameElement | null>(null);
  const [dropdownState, setDropdownState] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const isPrebuilt = location.pathname.startsWith("/prebuilt");

  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const dimensionOptions = useAppSelector(getDimensionOptions);
  const cabinetCatalog = useAppSelector(getCabinetCatalog);

  console.log("selectedSceneProduct", selectedSceneProduct);

  const resolveCabinetTypeId = useCallback(
    (productType: string | null) => {
      if (!productType) return null;

      const normalized = productType.toLowerCase();
      const match = cabinetCatalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase()));

      return match?.code ?? null;
    },
    [cabinetCatalog.typeCabinetRules],
  );

  const showDropdownAt = useCallback((clientX: number, clientY: number) => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    const rect = iframeEl.getBoundingClientRect();
    const x = rect.left + clientX;
    const y = rect.top + clientY - 120;
    setDropdownState({ visible: true, x, y });
  }, []);

  // Bridge PlayCanvas Configurator API
  useEffect(() => {
    (window as any).containerRef = containerRef;
    (window as any).playCanvasReady = false;

    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    let pollId: number | null = null;

    const markReady = () => {
      (window as any).playCanvasReady = true;
      window.dispatchEvent(new Event("playcanvas-ready"));
    };

    const tryBridgeApi = (cw: any) => {
      const api = cw?.ConfiguratorAPI;
      const addProduct = api?.addProduct || cw?.addProduct;
      if (typeof addProduct === "function") {
        cw.addProduct = api?.addProduct ? api.addProduct.bind(api) : addProduct.bind(api || cw);
        markReady();
        return true;
      }
      return false;
    };

    const handleLoad = () => {
      const cw = iframeEl.contentWindow as any;
      if (!cw) return;

      if (tryBridgeApi(cw)) return;

      const startedAt = Date.now();
      const pollInterval = 200;
      const maxWaitMs = 30000;

      pollId = window.setInterval(() => {
        if (tryBridgeApi(cw)) {
          if (pollId !== null) clearInterval(pollId);
          pollId = null;
          return;
        }

        if (Date.now() - startedAt > maxWaitMs) {
          if (pollId !== null) clearInterval(pollId);
          pollId = null;
          console.warn("PlayCanvasIntegration: ConfiguratorAPI.addProduct not available");
        }
      }, pollInterval);
    };

    iframeEl.addEventListener("load", handleLoad);
    return () => {
      iframeEl.removeEventListener("load", handleLoad);
      if (pollId !== null) clearInterval(pollId);
    };
  }, []);

  // useEffect(() => {
  //   if (!playCanvasReady) return;

  //   const tool = getDimensionTool();
  //   tool?.setEnabled(true);
  // }, [playCanvasReady]);

  const productIds = useAppSelector((store) => store.rootStateUI.product.productIds);

  const handleSetWidth = useCallback(
    async (width: number) => {
      if (!selectedSceneProduct) return;

      try {
        await setConfig(selectedSceneProduct, { Width: width });
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set width", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [selectedSceneProduct],
  );

  const handleSetDepth = useCallback(
    async (depth: number) => {
      if (!productIds) return;

      try {
        await setConfigBatch(productIds, { Depth: depth });
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set width", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [productIds],
  );

  const handleRemoveProducts = useCallback(async () => {
    if (!selectedSceneProduct) return;

    try {
      await removeProduct(selectedSceneProduct);
      dispatch(removeProductId(selectedSceneProduct));
    } catch (error) {
      console.error("[PlayCanvasIntegration] Failed to remove product", error);
    } finally {
      setDropdownState((prev) => ({ ...prev, visible: false }));
    }
  }, [dispatch, selectedSceneProduct]);

  const normalizeProductType = useCallback((value: string, productId: string) => {
    const lastDash = value.lastIndexOf("-");
    if (lastDash > 0) {
      const suffix = value.slice(lastDash + 1);
      if (suffix.length >= 6) {
        return value.slice(0, lastDash);
      }
    }

    if (value === productId) {
      const idLastDash = productId.lastIndexOf("-");
      if (idLastDash > 0) {
        const idSuffix = productId.slice(idLastDash + 1);
        if (idSuffix.length >= 6) {
          return productId.slice(0, idLastDash);
        }
      }
    }

    return value;
  }, []);
  const resolveProductTypeFromId = useCallback(
    (productId: string, config?: Record<string, unknown>) => {
      const configProductType = typeof config?.productType === "string" ? config.productType : null;
      if (configProductType) return normalizeProductType(configProductType, productId);

      const configEntityName = typeof config?.entityName === "string" ? config.entityName : null;
      if (configEntityName) return normalizeProductType(configEntityName, productId);

      const lastDash = productId.lastIndexOf("-");
      if (lastDash > 0) {
        return productId.slice(0, lastDash);
      }

      return productId;
    },
    [normalizeProductType],
  );

  const handleDuplicateProduct = useCallback(() => {
    if (!selectedSceneProduct) return;
    setDuplicateSourceId(selectedSceneProduct);
    setVisibleButtons(true);
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [selectedSceneProduct]);

  useEffect(() => {
    if (!duplicateSourceId) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      try {
        const config = await getConfig(duplicateSourceId);
        if (!config) return;
        const mergedConfig = { ...config, ...selectedProductConfig };

        console.log("mergedConfig", mergedConfig);

        const productType = resolveProductTypeFromId(duplicateSourceId, mergedConfig);
        const productId = await setProductByParams(productType, entityId, side);
        if (!productId) return;

        await setConfig(productId, mergedConfig);
        dispatch(addProductId(productId));
        updateDimensionDataForProduct(productId, mergedConfig);
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to duplicate product", error);
      } finally {
        setVisibleButtons(false);
        setDuplicateSourceId(null);
      }
    };

    setHandleButtonClick(onPlusClick);

    return () => {
      setVisibleButtons(false);
    };
  }, [dispatch, duplicateSourceId, resolveProductTypeFromId, selectedProductConfig]);

  // Navigate to the Cabinet builder page with the enabled Right sidebar.
  const handleAddAdditionalProduct = useCallback(() => {
    navigate("/custom/cabinet-builder?accordion=cabinet-type");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const handleSwapProducts = useCallback(
    (idA: string, idB: string) => {
      swapProducts(idA, idB);
      dispatch(swapProductIds({ idA, idB }));
    },
    [dispatch],
  );

  const handleMoveProduct = useCallback(
    (direction: "left" | "right") => {
      if (!selectedSceneProduct) return;

      const orderedIds = getOrderedProductIds(productIds);
      const currentIndex = orderedIds.indexOf(selectedSceneProduct);
      if (currentIndex === -1) return;

      const neighborIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
      if (neighborIndex < 0 || neighborIndex >= orderedIds.length) return;

      handleSwapProducts(selectedSceneProduct, orderedIds[neighborIndex]);
      setDropdownState((prev) => ({ ...prev, visible: false }));
    },
    [handleSwapProducts, productIds, selectedSceneProduct],
  );

  const handleOpenCabinetColor = useCallback(() => {
    navigate("/custom/cabinet-colors?accordion=cabinet-color");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  }, [navigate]);

  const selectToolAttachedRef = useRef(false);
  const selectTool = getSelectTool();

  if (selectTool && !selectToolAttachedRef.current) {
    selectToolAttachedRef.current = true;

    const dimensionTool = getDimensionTool();
    dimensionTool?.setEnabled(true);

    selectTool.on("select", (selectedEntity) => {
      const firstSelected = Array.isArray(selectedEntity) ? selectedEntity[0] : selectedEntity;

      if (firstSelected) {
        console.log(`Выбран объект: ${firstSelected.name}`);

        (async () => {
          const config = await getConfig(firstSelected.name ?? "");

          if (!config) return;

          dispatch(setSelectedSceneProduct(firstSelected.name!));
          // replace any previous selection
          selectTool?.setSelectedByName(firstSelected.name ?? "", { mode: "replace" });

          updateDimensionDataForProduct(firstSelected.name ?? "", config);
        })();

        const lastPos = lastPointerPosRef.current;

        if (lastPos) {
          showDropdownAt(lastPos.x, lastPos.y);
        } else {
          const iframeEl = containerRef.current;
          if (iframeEl) {
            const rect = iframeEl.getBoundingClientRect();
            showDropdownAt(rect.width / 2, rect.height / 2);
          }
        }
      } else {
        console.log("клик в пустоту");
        // dispatch(setSelectedSceneProduct(""));
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    });
  }

  useEffect(() => {
    if (!selectedSceneProduct) return;
    return;

    const loadConfig = async () => {
      const config = await getConfig(selectedSceneProduct);
      if (!config) return;

      const productType =
        (typeof config.ProductType === "string" && config.ProductType) ||
        (typeof config.productType === "string" && config.productType) ||
        (typeof config.type === "string" && config.type) ||
        null;
      const resolvedCabinetTypeId = resolveCabinetTypeId(productType ?? selectedSceneProduct);

      if (resolvedCabinetTypeId !== null) {
        dispatch(setActiveCabinetType(resolvedCabinetTypeId));
      }

      dispatch(setSelectedProductConfig(config));

      const nextDimensions: { width?: number; height?: number; depth?: number } = {};

      if (typeof config.Width === "number") nextDimensions.width = config.Width;
      if (typeof config.Height === "number") nextDimensions.height = config.Height;
      if (typeof config.Depth === "number") nextDimensions.depth = config.Depth;

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }
    };

    loadConfig();
  }, [dispatch, resolveCabinetTypeId, selectedSceneProduct]);

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const widthOptions = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    const depthOptions = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);

    const items: DropdownItem[] = [
      {
        id: "resize",
        label: "Resize",
        children: [
          {
            id: "resize-width",
            label: "Width",
            children: widthOptions.map((value) => ({
              id: `resize-width-${value}`,
              label: `${value}`,
              onClick: () => handleSetWidth(Number(value)),
            })),
          },
          {
            id: "resize-depth",
            label: "Depth",
            children: depthOptions.map((value) => ({
              id: `resize-depth-${value}`,
              label: `${value}`,
              onClick: () => handleSetDepth(Number(value)),
            })),
          },
        ],
      },
      {
        id: "reposition",
        label: "Reposition",
        children: [
          { id: "reposition-left", label: "Move left", onClick: () => handleMoveProduct("left") },
          { id: "reposition-right", label: "Move right", onClick: () => handleMoveProduct("right") },
        ],
      },
      {
        id: "color",
        label: "Color",
        children: [
          {
            id: "cabinet-select-color",
            label: "Select Color",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCabinetColor,
          },
        ],
      },
      {
        id: "add",
        label: "Add",
        trailing: "",
        children: [
          // { id: "add-left", label: "Add to left", onClick: () => handleAddLeft(activeDrawerProduct) },
          // { id: "add-right", label: "Add to right", onClick: () => handleAddRight(activeDrawerProduct) },
          {
            id: "add-right",
            label: "Add Cabinet",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: () => handleAddAdditionalProduct(),
          },
        ],
      },
      { id: "duplicate", label: "Duplicate", trailing: "+", onClick: handleDuplicateProduct },
      { id: "open", label: "Open", trailing: <OpenMenuIcon />, onClick: () => {} },
    ];

    if (productIds.length) {
      items.push({ id: "delete", label: "Delete", trailing: <DeleteMenuIcon />, onClick: handleRemoveProducts });
    }

    return items;
  }, [
    handleRemoveProducts,
    handleSetWidth,
    handleSetDepth,
    dimensionOptions.depth,
    dimensionOptions.width,
    productIds.length,
    handleMoveProduct,
    handleOpenCabinetColor,
    handleAddAdditionalProduct,
    handleDuplicateProduct,
  ]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <iframe
        ref={containerRef}
        title="scene"
        id="demo"
        width="100%"
        height="100%"
        src={PLAYCANVAS_SRC}
        style={{
          width: "100%",
          height: "100%",
          flex: "1 1 auto",
          border: "none",
          display: "block",
        }}
      />

      {dropdownState.visible && (
        <div
          style={{
            position: "absolute",
            top: dropdownState.y,
            left: dropdownState.x,
            pointerEvents: "auto",
            zIndex: 10,
          }}
        >
          {!isPrebuilt && <NestedDropdown items={dropdownItems} />}
        </div>
      )}
    </div>
  );
};
