import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";
import { CloseBtnIcon } from "@/shared/assets/images/svg/CloseBtnIcon";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import { BaseButton } from "@/shared/ui/Buttons/BaseButton";
import { PopupCenterContent } from "@/shared/ui/Popups/PopupCenterContent/PopupCenterContent";
import image from "../../../../shared/assets/images/png/img_png.png";
import upperHandleImage from "@/shared/assets/images/jpeg/UpperGHandle.jpg";
import centralHandleImage from "@/shared/assets/images/jpeg/CentralGHandle.jpg";
import ptoHandleImage from "@/shared/assets/images/jpeg/PTOHandle.jpg";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getIsActiveStyleSidebar } from "../../model/store/selectors";
import { setOpenStyleSidebar } from "../../model/store/slice";
import {
  getDimensionOptions,
  getDrawerProduct,
  getCabinetColor,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getActiveCabinetRule,
  getDrawerPanelFluting,
  getGrainDirection,
  getSelectedDimensions,
  getSelectedProducts,
  getSelectedProductConfig,
  getHeightLocked,
  getSinkType,
} from "@/entities/product/model/store/selectors";
import {
  addProductId,
  removeProductId,
  setPlacedCabinetStyle,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

import s from "./RightCabinetStyleSidebar.module.scss";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setProductByParams } from "@/utils/functions/playcanvas/setProductByParams";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { updateDimensionDataForProduct } from "@/utils/functions/playcanvas/updateDimensionData";
import { useHistorySnapshot } from "@/entities/history/lib/useHistorySnapshot";
import { removeProduct } from "@/utils/functions/playcanvas/removeProduct";
import { setSidePanel } from "@/utils/functions/playcanvas/sidePanels";

interface RightCabinetStyleSidebarProps {
  onProductAdded?: () => void;
}

interface PendingHandleChange {
  next: string;
  previous: string | undefined;
  previousDimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
}

interface PendingOssHandleChange {
  next: string;
  previous: string | undefined;
  previousDimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
  ossIds: string[];
}

export const RightCabinetStyleSidebar = ({ onProductAdded }: RightCabinetStyleSidebarProps) => {
  const dispatch = useAppDispatch();
  const isOpenedStyleSidebar = useAppSelector(getIsActiveStyleSidebar);
  const isPlayCanvasReady = usePlayCanvasReady();
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const dimensionOptions = useAppSelector(getDimensionOptions);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeDrawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const activeCabinetRule = useAppSelector(getActiveCabinetRule);
  const heightLocked = useAppSelector(getHeightLocked);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const sinkType = useAppSelector(getSinkType);

  const saveSnapshot = useHistorySnapshot();
  const handlesDisabled = Boolean(activeCabinetRule?.isOpen) || dimensionOptions.handles.length === 0;
  const [pendingHandleChange, setPendingHandleChange] = useState<PendingHandleChange | null>(null);
  const [pendingOssHandleChange, setPendingOssHandleChange] = useState<PendingOssHandleChange | null>(null);
  const [handleLockNotice, setHandleLockNotice] = useState<string | null>(null);
  const hasModalOpen = pendingHandleChange !== null || pendingOssHandleChange !== null || handleLockNotice !== null;

  const handleOptions = useMemo(
    () =>
      dimensionOptions.handles?.length
        ? dimensionOptions.handles
        : handlesDisabled
          ? []
          : [
              { label: "Push to open", value: "handle_pto" },
              { label: "Upper Groove", value: "handle_urban_topcut" },
              { label: "Central Groove", value: "handle_urban_botcut" },
            ],
    [dimensionOptions.handles, handlesDisabled],
  );

  const handleImage = useMemo(() => {
    const value = selectedProductConfig?.Handle;
    if (value === "handle_urban_topcut") return upperHandleImage;
    if (value === "handle_urban_botcut") return centralHandleImage;
    if (value === "handle_pto") return ptoHandleImage;
    return image;
  }, [selectedProductConfig?.Handle]);

  const productConfig = useMemo(() => {
    if (selectedDimensions.width === null || selectedDimensions.height === null || selectedDimensions.depth === null) {
      return null;
    }

    return {
      ...selectedProductConfig,
      Width: selectedDimensions.width,
      Height: selectedDimensions.height,
      Depth: selectedDimensions.depth,
      CabinetColor: cabinetColor,
      CountertopColor: countertopColor,
      HandleGrooveColor: handleGrooveColor,
      DrawerPanelFluting: drawerPanelFluting,
      GrainDirection: grainDirection,
    };
  }, [
    cabinetColor,
    countertopColor,
    handleGrooveColor,
    drawerPanelFluting,
    grainDirection,
    selectedDimensions.depth,
    selectedDimensions.height,
    selectedDimensions.width,
    selectedProductConfig,
  ]);

  const handleCloseSidebar = () => {
    dispatch(setOpenStyleSidebar(false));
  };

  const handleChangeWidth = (value?: string | number) => {
    if (value === undefined) return;
    dispatch(setSelectedDimensions({ width: Number(value) }));
  };

  const handleChangeDepth = (value?: string | number) => {
    if (value === undefined) return;
    dispatch(setSelectedDimensions({ depth: Number(value) }));
  };

  // const handleChangeHeight = (value: string | number) => {
  //   dispatch(setSelectedDimensions({ height: Number(value) }));
  // };

  const applyHandleType = async (handleType: string) => {
    await saveSnapshot();
    dispatch(
      setSelectedProductConfig({
        ...(selectedProductConfig ?? {}),
        Handle: handleType,
      }),
    );

    if (selectedProducts.length) {
      await setConfigBatch(selectedProducts, { Handle: handleType });
    }
  };

  const restoreHandleType = async (
    handleType: string | undefined,
    previousDimensions: { width: number | null; height: number | null; depth: number | null },
  ) => {
    if (!handleType) return;

    dispatch(
      setSelectedProductConfig({
        ...(selectedProductConfig ?? {}),
        Handle: handleType,
      }),
    );

    if (selectedProducts.length) {
      await setConfigBatch(selectedProducts, { Handle: handleType });
    }

    dispatch(setSelectedDimensions(previousDimensions));

    const dimConfig: { Height?: number; Depth?: number } = {};
    if (typeof previousDimensions.height === "number") {
      dimConfig.Height = previousDimensions.height;
    }
    if (typeof previousDimensions.depth === "number") {
      dimConfig.Depth = previousDimensions.depth;
    }

    if (selectedProducts.length && Object.keys(dimConfig).length > 0) {
      await setConfigBatch({}, dimConfig);
      selectedProducts.forEach((id) => updateDimensionDataForProduct(id, dimConfig));
    }
  };

  const closePendingHandleChange = async (isConfirmed = false) => {
    if (!pendingHandleChange) return;

    const { previous, next, previousDimensions } = pendingHandleChange;
    setPendingHandleChange(null);

    if (isConfirmed || previous === next) return;

    await restoreHandleType(previous, previousDimensions);
  };

  const handleSetHandleType = async (handleType: string) => {
    if (typeof heightLocked === "number") {
      const option = dimensionOptions.handles.find((item) => String(item.value) === handleType);
      if (option?.disabled && option.reason?.startsWith("Not available for current configuration height")) {
        setHandleLockNotice(
          `A module with only ${heightLocked}cm height is present (e.g. Side Shelf). While it is on the scene, only handles for ${heightLocked}cm are available.`,
        );
        return;
      }
    }

    const previousHandle = selectedProductConfig?.Handle as string | undefined;
    if (previousHandle === handleType) return;

    const isSwitchingAwayFromPto = previousHandle === "handle_pto" && handleType !== "handle_pto";
    const ossIds = selectedProducts.filter((id) => id.toLowerCase().includes("side-shelf"));
    if (isSwitchingAwayFromPto && ossIds.length > 0) {
      setPendingOssHandleChange({
        next: handleType,
        previous: previousHandle,
        previousDimensions: {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
        },
        ossIds,
      });
      return;
    }

    await applyHandleType(handleType);

    if (selectedProducts.length > 0) {
      setPendingHandleChange({
        next: handleType,
        previous: previousHandle,
        previousDimensions: {
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          depth: selectedDimensions.depth,
        },
      });
    }
  };

  const closePendingOssHandleChange = () => {
    setPendingOssHandleChange(null);
  };

  const confirmPendingOssHandleChange = async () => {
    if (!pendingOssHandleChange) return;
    const { next, previous, previousDimensions, ossIds } = pendingOssHandleChange;
    setPendingOssHandleChange(null);

    for (const ossId of ossIds) {
      await removeProduct(ossId);
      dispatch(removeProductId(ossId));
    }

    await applyHandleType(next);

    if (selectedProducts.length - ossIds.length > 0) {
      setPendingHandleChange({
        next,
        previous,
        previousDimensions,
      });
    }
  };

  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (!selectedProducts.length) return;
    if (selectedDimensions.height === null || selectedDimensions.depth === null || selectedDimensions.width === null) {
      return;
    }

    const dimConfig = { Height: selectedDimensions.height, Depth: selectedDimensions.depth };
    setConfigBatch({}, dimConfig);

    selectedProducts.forEach((id) => updateDimensionDataForProduct(id, dimConfig));
  }, [selectedDimensions, selectedProducts, isOpenedStyleSidebar]);

  const prevHandleRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only set default Handle if it's completely missing (first time, no previous selection)
    if (!handlesDisabled && !selectedProductConfig?.Handle && selectedProductConfig !== null) {
      dispatch(
        setSelectedProductConfig({
          ...selectedProductConfig,
          Handle: "handle_urban_topcut",
        }),
      );
    }
  }, [dispatch, selectedProductConfig, handlesDisabled]);

  // Sync handle to PlayCanvas when it changes (e.g. auto-reset due to rule change)
  useEffect(() => {
    const currentHandle = selectedProductConfig?.Handle;
    const prevHandle = prevHandleRef.current;
    prevHandleRef.current = currentHandle as string | undefined;

    if (!currentHandle || currentHandle === prevHandle) return;
    if (!selectedProducts.length) return;

    setConfigBatch(selectedProducts, { Handle: currentHandle });
  }, [selectedProductConfig?.Handle, selectedProducts]);

  // Show plus buttons when the sidebar is opened.
  useEffect(() => {
    const options =
      isOpenedStyleSidebar && activeDrawerProduct === "Side-Shelf" ? { productType: "Side-Shelf" } : undefined;
    setVisibleButtons(isOpenedStyleSidebar, options);

    return () => {
      setVisibleButtons(false);
    };
  }, [activeDrawerProduct, isOpenedStyleSidebar]);

  // Close sidebar when clicking outside of it.
  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (hasModalOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!sidebarRef.current) return;

      const target = event.target as Element | null;
      if (target?.closest?.('[data-filter-menu="true"]')) return;

      if (sidebarRef.current.contains(event.target as Node)) return;

      dispatch(setOpenStyleSidebar(false));
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch, hasModalOpen, isOpenedStyleSidebar]);

  // Set the product to the desired side (left/right).
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      console.log("Clicked Plus Button", entityId, side);

      if (!activeDrawerProduct) return;

      if (activeDrawerProduct === "Side-Shelf") {
        await setSidePanel("None", side);
      }

      await saveSnapshot();
      const productId = await setProductByParams(activeDrawerProduct, entityId, side);

      if (!productId) return;

      if (productConfig) {
        const isSinkBase = activeDrawerProduct.toLowerCase().includes("sink-base");
        const nextConfig =
          isSinkBase && sinkType
            ? {
                ...productConfig,
                sinkType,
              }
            : productConfig;

        await setConfig(productId, nextConfig);
      }

      const storedConfig = await getConfig(productId);
      console.log("[RightCabinetStyleSidebar] stored config", storedConfig);

      dispatch(addProductId(productId));

      const drawers = (productConfig as Record<string, unknown>)?.Drawers as string | undefined;
      const drawerRawValue = drawers === "1D" ? "1" : drawers === "2D" ? "2" : drawers === "1DWID" ? "1+inner" : null;
      if (drawerRawValue) dispatch(setPlacedCabinetStyle({ id: productId, value: drawerRawValue }));

      // Close sidebar and reset accordion to default state
      dispatch(setOpenStyleSidebar(false));
      if (onProductAdded) {
        onProductAdded();
      }
      // Keep last active cabinet type for downstream UI rules (e.g., side panels).
    };

    setHandleButtonClick(onPlusClick);
  }, [isPlayCanvasReady, activeDrawerProduct, productConfig, sinkType, dispatch, onProductAdded, saveSnapshot]);

  return (
    <>
      <PopupCenterContent isOpening={handleLockNotice !== null} onClose={() => setHandleLockNotice(null)}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Handle Change Blocked</div>
            <div className={s.confirmClose} onClick={() => setHandleLockNotice(null)}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>{handleLockNotice}</p>
          </div>
          <div className={s.confirmFooter}>
            <div>
              <BaseButton onClick={() => setHandleLockNotice(null)} fullWidth={true}>
                Ok
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingHandleChange !== null} onClose={() => void closePendingHandleChange()}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Handle Style Updated</div>
            <div className={s.confirmClose} onClick={() => void closePendingHandleChange()}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>The handle style has been updated for all drawer cabinets.</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={() => void closePendingHandleChange()} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void closePendingHandleChange(true)} fullWidth={true}>
                Confirm
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <PopupCenterContent isOpening={pendingOssHandleChange !== null} onClose={closePendingOssHandleChange}>
        <div className={s.confirmPopup}>
          <div className={s.confirmHeader}>
            <div className={s.confirmTitle}>Remove Side Shelf?</div>
            <div className={s.confirmClose} onClick={closePendingOssHandleChange}>
              <CloseBtnIcon />
            </div>
          </div>
          <div className={s.confirmContent}>
            <p>Side Shelf cabinets are only compatible with a PTO handle.</p>
            <p>Switching to another handle will remove all Side Shelf cabinets. Continue?</p>
          </div>
          <div className={s.confirmFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <BaseButton variant="ghost" onClick={closePendingOssHandleChange} fullWidth={true}>
                Cancel
              </BaseButton>
              <BaseButton onClick={() => void confirmPendingOssHandleChange()} fullWidth={true}>
                Approve
              </BaseButton>
            </div>
          </div>
        </div>
      </PopupCenterContent>

      <div ref={sidebarRef} className={`${s.cabinetStyleSidebar} ${isOpenedStyleSidebar ? s.active : ""}`}>
        <div className={s.arrow} onClick={handleCloseSidebar}>
          <ArrowRight width="16" />
        </div>
        <div className={s.content}>
          <div className={s.contentItem}>
            <div>Width</div>
            <FilterSelection
              label={"Width"}
              options={dimensionOptions.width}
              value={selectedDimensions.width ?? ""}
              onSelect={(value) => handleChangeWidth(value)}
            />
          </div>

          <div className={s.contentItem}>
            <div>Depth</div>
            <FilterSelection
              label={"Depth"}
              options={dimensionOptions.depth}
              value={selectedDimensions.depth ?? ""}
              onSelect={(value) => handleChangeDepth(value)}
            />
          </div>

          {/* <div className={s.contentItem}>
          <div>Height</div>
          <FilterSelection
            label={"Height"}
            options={dimensionOptions.height}
            value={selectedDimensions.height}
            onSelect={(value) => handleChangeHeight(value)}
          />
        </div> */}

          {!handlesDisabled && (
            <div className={s.contentItem}>
              <div>Handle</div>
              <FilterSelection
                label={"Handle"}
                options={handleOptions}
                value={selectedProductConfig?.Handle as string | undefined}
                onSelect={(value) => {
                  if (value === undefined) return;
                  handleSetHandleType(String(value));
                }}
              />
            </div>
          )}

          {!handlesDisabled && (
            <div className={s.image}>
              <img src={handleImage} alt="handle preview" />
            </div>
          )}
        </div>

        <div className={s.bottomText}>
          Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
        </div>
      </div>
    </>
  );
};
