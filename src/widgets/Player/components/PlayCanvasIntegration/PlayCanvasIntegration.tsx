import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { NestedDropdown, type DropdownItem } from "@/shared/ui/NestedDropdown/NestedDropdown";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { setWidth } from "@/utils/functions/playcanvas/setWidth";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { addProductId, removeProductId } from "@/features/product/model/store/slice";
import { addProduct } from "@/utils/functions/playcanvas/addProduct";

const PLAYCANVAS_SRC = "/HastingCabinetsParametrization/index.html";

export const PlayCanvasIntegration = () => {
  const containerRef = useRef<HTMLIFrameElement | null>(null);
  const [dropdownState, setDropdownState] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

  const dispatch = useAppDispatch();

  const location = useLocation();
  const isPrebuilt = location.pathname.startsWith("/prebuilt");

  const handleAdd = async (name: string) => {
    try {
      const productId = await addProduct(name);

      if (productId) {
        dispatch(addProductId(productId));
      }
    } catch (error) {
      console.error("[ProductModelItem] Failed to apply preset", error);
    }
  };

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

  // Toggle dropdown on right click inside iframe; hide on regular click
  useEffect(() => {
    const iframeEl = containerRef.current;
    if (!iframeEl) return;

    let iframeDoc: Document | null = null;
    const handleIframePointer = (event: PointerEvent) => {
      if (event.button === 2) {
        event.preventDefault();
        const rect = iframeEl.getBoundingClientRect();
        const x = rect.left + event.clientX;
        const y = rect.top + event.clientY - 120; // lift the dropdown slightly above cursor
        setDropdownState({ visible: true, x, y });
      } else {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    };

    const attachPointerListener = () => {
      iframeDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document || null;
      if (!iframeDoc) return;
      iframeDoc.addEventListener("pointerdown", handleIframePointer, true);
    };

    const detachPointerListener = () => {
      if (iframeDoc) {
        iframeDoc.removeEventListener("pointerdown", handleIframePointer, true);
      }
      iframeDoc = null;
    };

    iframeEl.addEventListener("load", attachPointerListener);
    attachPointerListener();

    return () => {
      iframeEl.removeEventListener("load", attachPointerListener);
      detachPointerListener();
    };
  }, []);

  const productIds = useAppSelector((store) => store.rootStateUI.product.productIds);

  const handleSetWidth = useCallback(
    async (width: number) => {
      const targetId = productIds[productIds.length - 1];
      if (!targetId) {
        console.warn("[PlayCanvasIntegration] No product to resize");
        return;
      }

      try {
        await setWidth(targetId, width);
      } catch (error) {
        console.error("[PlayCanvasIntegration] Failed to set width", error);
      } finally {
        setDropdownState((prev) => ({ ...prev, visible: false }));
      }
    },
    [productIds],
  );

  const handleRemoveProducts = useCallback(async () => {
    if (!productIds.length) return;

    const [idToRemove] = productIds;

    try {
      await removeProduct(idToRemove);
      dispatch(removeProductId(idToRemove));
    } catch (error) {
      console.error("[PlayCanvasIntegration] Failed to remove product", error);
    } finally {
      setDropdownState((prev) => ({ ...prev, visible: false }));
    }
  }, [dispatch, productIds]);

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const widthOptions = [25, 35, 50, 60, 70, 90, 105, 120];

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
              onClick: () => handleSetWidth(value),
            })),
          },
        ],
      },
      { id: "add", label: "Add", trailing: "+", onClick: () => handleAdd("CabinetUniBox") },
    ];

    if (productIds.length) {
      items.push({ id: "delete", label: "Delete", trailing: "", onClick: handleRemoveProducts });
    }

    return items;
  }, [handleRemoveProducts, handleSetWidth, productIds.length]);

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
