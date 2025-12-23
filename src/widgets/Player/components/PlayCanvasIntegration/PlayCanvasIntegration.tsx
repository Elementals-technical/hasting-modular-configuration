import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import {
  addProductId,
  removeProductId,
  setSelectedSceneProduct,
  swapProductIds,
} from "@/entities/product/model/store/slice";
import { addProduct } from "@/utils/functions/playcanvas/addProduct";
import { addProductByLeft } from "@/utils/functions/playcanvas/addProductByLeft";
import { addProductByRight } from "@/utils/functions/playcanvas/addProductByRight";
import { swapProducts } from "@/utils/functions/playcanvas/swapProducts.ts";
import { ArrowTopRight } from "@/shared/assets/images/svg/ArrowTopRight.tsx";
import { getSelectTool } from "@/utils/functions/playcanvas/getSelectTool";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import {
  getActiveCountertopColor,
  getCabinetColor,
  getDimensionOptions,
  getDrawerProduct,
  getHandleGrooveColor,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSelectedSceneProduct,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

// 🔧 UPDATE THIS VERSION WHEN DEPLOYING NEW PLAYCANVAS BUILD
const PLAYCANVAS_VERSION = "008";
const PLAYCANVAS_SRC = `/HastingCabinetsParametrization/index.html?v=${PLAYCANVAS_VERSION}`;
// const RIGHT_BUTTON = 2;
// const HOLD_MS = 250;
// const MOVE_THRESHOLD = 6;

export const PlayCanvasIntegration = () => {
  const containerRef = useRef<HTMLIFrameElement | null>(null);
  const [dropdownState, setDropdownState] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const dispatch = useAppDispatch();

  const location = useLocation();
  const navigate = useNavigate();

  const isPrebuilt = location.pathname.startsWith("/prebuilt");

  const selectedSceneProduct = useAppSelector(getSelectedSceneProduct);
  const activeDrawerProduct = useAppSelector(getDrawerProduct);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const sinkType = useAppSelector(getSinkType);
  const dimensionOptions = useAppSelector(getDimensionOptions);

  console.log("selectedSceneProduct", selectedSceneProduct);

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

  // Toggle dropdown on short right click; allow orbit/drag on long-press or drag with right button
  // useEffect(() => {
  //   const iframeEl = containerRef.current;
  //   if (!iframeEl) return;

  //   const holdTimer = { current: null as number | null };
  //   const rightDown = { current: false };
  //   const orbitMode = { current: false };
  //   const startPos = { current: { x: 0, y: 0 } };

  //   const clearHold = () => {
  //     if (holdTimer.current !== null) {
  //       window.clearTimeout(holdTimer.current);
  //       holdTimer.current = null;
  //     }
  //   };

  //   let iframeDoc: Document | null = null;

  //   const handlePointerDown = (event: PointerEvent) => {
  //     if (event.button === 0) {
  //       lastPointerPosRef.current = { x: event.clientX, y: event.clientY };
  //       return;
  //     }

  //     if (event.button !== RIGHT_BUTTON) {
  //       setDropdownState((prev) => ({ ...prev, visible: false }));
  //       return;
  //     }

  //     rightDown.current = true;
  //     orbitMode.current = false;
  //     startPos.current = { x: event.clientX, y: event.clientY };
  //     setDropdownState((prev) => ({ ...prev, visible: false }));

  //     clearHold();
  //     holdTimer.current = window.setTimeout(() => {
  //       orbitMode.current = true;
  //     }, HOLD_MS);
  //   };

  //   const handlePointerMove = (event: PointerEvent) => {
  //     if (!rightDown.current) return;
  //     const dx = event.clientX - startPos.current.x;
  //     const dy = event.clientY - startPos.current.y;
  //     if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
  //       orbitMode.current = true;
  //       clearHold();
  //     }
  //   };

  //   const handlePointerUp = (event: PointerEvent) => {
  //     if (event.button !== RIGHT_BUTTON) return;

  //     clearHold();
  //     rightDown.current = false;

  //     if (orbitMode.current) {
  //       orbitMode.current = false;
  //       return;
  //     }

  //     event.preventDefault();
  //     showDropdownAt(event.clientX, event.clientY);
  //   };

  //   const handleContextMenu = (event: MouseEvent) => {
  //     if (orbitMode.current || rightDown.current) {
  //       event.preventDefault();
  //     }
  //   };

  //   const attachPointerListener = () => {
  //     iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document || null;
  //     if (!iframeDoc) return;

  //     iframeDoc.addEventListener("pointerdown", handlePointerDown, true);
  //     iframeDoc.addEventListener("pointermove", handlePointerMove, true);
  //     iframeDoc.addEventListener("pointerup", handlePointerUp, true);
  //     iframeDoc.addEventListener("contextmenu", handleContextMenu, true);
  //   };

  //   const detachPointerListener = () => {
  //     if (iframeDoc) {
  //       iframeDoc.removeEventListener("pointerdown", handlePointerDown, true);
  //       iframeDoc.removeEventListener("pointermove", handlePointerMove, true);
  //       iframeDoc.removeEventListener("pointerup", handlePointerUp, true);
  //       iframeDoc.removeEventListener("contextmenu", handleContextMenu, true);
  //     }

  //     iframeDoc = null;
  //   };

  //   iframeEl.addEventListener("load", attachPointerListener);
  //   attachPointerListener();

  //   return () => {
  //     iframeEl.removeEventListener("load", attachPointerListener);
  //     detachPointerListener();
  //   };
  // }, [showDropdownAt]);

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

  const handleAddLeft = useCallback(
    async (name: string) => {
      try {
        const productId = await addProductByLeft(name);

        if (productId) {
          await setConfig(productId, {
            ...(selectedProductConfig ?? {}),
            Width: selectedDimensions.width,
            Height: selectedDimensions.height,
            Depth: selectedDimensions.depth,
            CabinetColor: cabinetColor,
            CountertopColor: countertopColor,
            HandleGrooveColor: handleGrooveColor,
            sinkType,
          });
          dispatch(addProductId(productId));
        }
      } catch (error) {
        console.error("[ProductModelItem] Failed to add product to the left", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [
      cabinetColor,
      countertopColor,
      dispatch,
      handleGrooveColor,
      selectedDimensions.depth,
      selectedDimensions.height,
      selectedDimensions.width,
      selectedProductConfig,
      sinkType,
    ],
  );

  const handleAdd = useCallback(
    async (name: string) => {
      try {
        const productId = await addProduct(name);

        if (productId) {
          dispatch(addProductId(productId));
        }
      } catch (error) {
        console.error("[ProductModelItem] Failed to add product", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [dispatch],
  );

  const handleAddRight = useCallback(
    async (name: string) => {
      try {
        const productId = await addProductByRight(name);

        if (productId) {
          await setConfig(productId, {
            ...(selectedProductConfig ?? {}),
            Width: selectedDimensions.width,
            Height: selectedDimensions.height,
            Depth: selectedDimensions.depth,
            CabinetColor: cabinetColor,
            CountertopColor: countertopColor,
            HandleGrooveColor: handleGrooveColor,
            sinkType,
          });
          dispatch(addProductId(productId));
        }
      } catch (error) {
        console.error("[ProductModelItem] Failed to add product to the right", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [
      cabinetColor,
      countertopColor,
      dispatch,
      handleGrooveColor,
      selectedDimensions.depth,
      selectedDimensions.height,
      selectedDimensions.width,
      selectedProductConfig,
      sinkType,
    ],
  );

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

  const handleOpenCabinetStyle = () => {
    navigate("/custom/cabinet-builder?accordion=cabinet-style");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  };

  const handleOpenCabinetColor = () => {
    navigate("/custom/cabinet-colors?accordion=cabinet-color");
    setDropdownState((prev) => ({ ...prev, visible: false }));
  };

  const handleSetDrawers = useCallback(
    async (drawers: string) => {
      if (!selectedSceneProduct) return;

      try {
        await setConfig(selectedSceneProduct, { Drawers: drawers });
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set drawers", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [selectedSceneProduct],
  );

  const handleSetHandleType = useCallback(
    async (handleType: string) => {
      if (!selectedSceneProduct) return;

      try {
        await setConfig(selectedSceneProduct, { Handle: handleType });
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set handle type", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [selectedSceneProduct],
  );

  const selectToolAttachedRef = useRef(false);
  const selectTool = getSelectTool();

  if (selectTool && !selectToolAttachedRef.current) {
    selectToolAttachedRef.current = true;
    selectTool.on("select", (selectedEntity) => {
      const firstSelected = Array.isArray(selectedEntity) ? selectedEntity[0] : selectedEntity;

      if (firstSelected) {
        console.log(`Выбран объект: ${firstSelected.name}`);
        dispatch(setSelectedSceneProduct(firstSelected.name!));
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
        dispatch(setSelectedSceneProduct(""));
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    });
  }

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const widthOptions = dimensionOptions.width.filter((option) => !option.disabled).map((option) => option.value);
    const depthOptions = dimensionOptions.depth.filter((option) => !option.disabled).map((option) => option.value);

    const drawerOptions = [
      { id: "drawer-1d", label: "1 Drawer", value: "1D" },
      { id: "drawer-2d", label: "2 Drawer", value: "2D" },
      { id: "drawer-1dwid", label: "1 Drawer with Inner Drawer", value: "1DWID" },
    ];

    const handleOptions = [
      { id: "handle-pto", label: "Pto handle", value: "handle_pto" },
      { id: "handle-urban-topcut", label: "Urban Handle Top Cut", value: "handle_urban_topcut" },
      { id: "handle-urban-botcut", label: "Urban Handle Bot Cut", value: "handle_urban_botcut" },
    ];

    const items: DropdownItem[] = [
      {
        id: "cabinet-style",
        label: "Cabinet Style",
        children: [
          {
            id: "cabinet-select-style",
            label: "Select Style",
            trailing: <ArrowTopRight color={"#333"} />,
            onClick: handleOpenCabinetStyle,
          },
        ],
      },
      {
        id: "cabinet-color",
        label: "Cabinet Color",
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
    ];

    if (selectedSceneProduct) {
      items.unshift(
        {
          id: "drawer-style",
          label: "Drawer Style",
          children: drawerOptions.map((option) => ({
            id: option.id,
            label: option.label,
            onClick: () => handleSetDrawers(option.value),
          })),
        },
        {
          id: "handle-style",
          label: "Handle Style",
          children: handleOptions.map((option) => ({
            id: option.id,
            label: option.label,
            onClick: () => handleSetHandleType(option.value),
          })),
        },
      );
    }

    const canAddDrawerProduct = Boolean(activeDrawerProduct);

    const addItem: DropdownItem =
      productIds.length > 0
        ? {
            id: "add",
            label: "Add",
            trailing: "",
            children: canAddDrawerProduct
              ? [
                  { id: "add-left", label: "Add to left", onClick: () => handleAddLeft(activeDrawerProduct) },
                  { id: "add-right", label: "Add to right", onClick: () => handleAddRight(activeDrawerProduct) },
                ]
              : [],
          }
        : {
            id: "add",
            label: "Add",
            trailing: "",
            onClick: () => handleAdd("UniOpenShelves"),
          };

    items.push(addItem);

    if (selectedSceneProduct) {
      items.unshift({
        id: "reposition",
        label: "Reposition",
        children: [
          { id: "reposition-left", label: "Move left", onClick: () => handleMoveProduct("left") },
          { id: "reposition-right", label: "Move right", onClick: () => handleMoveProduct("right") },
        ],
      });
    }

    if (productIds.length) {
      items.push({ id: "delete", label: "Delete", trailing: "", onClick: handleRemoveProducts });
    }

    return items;
  }, [
    handleAdd,
    handleAddLeft,
    handleAddRight,
    handleRemoveProducts,
    handleSetDrawers,
    handleSetHandleType,
    handleSetWidth,
    handleSetDepth,
    activeDrawerProduct,
    dimensionOptions.depth,
    dimensionOptions.width,
    productIds.length,
    selectedSceneProduct,
    handleMoveProduct,
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
