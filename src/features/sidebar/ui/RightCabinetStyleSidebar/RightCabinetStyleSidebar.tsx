import { useEffect, useMemo, useRef } from "react";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
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
  getSelectedDimensions,
  getSelectedProducts,
  getSelectedProductConfig,
} from "@/entities/product/model/store/selectors";
import { addProductId, setSelectedDimensions, setSelectedProductConfig } from "@/entities/product/model/store/slice";

import s from "./RightCabinetStyleSidebar.module.scss";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { setProductByParams } from "@/utils/functions/playcanvas/setProductByParams";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

interface RightCabinetStyleSidebarProps {
  onProductAdded?: () => void;
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
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);

  const handlesDisabled = Boolean(activeCabinetRule?.isOpen) || dimensionOptions.handles.length === 0;

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

  const productConfig = useMemo(
    () => {
      if (
        selectedDimensions.width === null ||
        selectedDimensions.height === null ||
        selectedDimensions.depth === null
      ) {
        return null;
      }

      return {
        ...(selectedProductConfig ?? {}),
        Width: selectedDimensions.width,
        Height: selectedDimensions.height,
        Depth: selectedDimensions.depth,
        CabinetColor: cabinetColor,
        CountertopColor: countertopColor,
        HandleGrooveColor: handleGrooveColor,
      };
    },
    [
      cabinetColor,
      countertopColor,
      handleGrooveColor,
      selectedDimensions.depth,
      selectedDimensions.height,
      selectedDimensions.width,
      selectedProductConfig,
    ],
  );

  const handleCloseSidebar = () => {
    dispatch(setOpenStyleSidebar(false));
  };

  const handleChangeWidth = (value: string | number) => {
    dispatch(setSelectedDimensions({ width: Number(value) }));
  };

  const handleChangeDepth = (value: string | number) => {
    dispatch(setSelectedDimensions({ depth: Number(value) }));
  };

  // const handleChangeHeight = (value: string | number) => {
  //   dispatch(setSelectedDimensions({ height: Number(value) }));
  // };

  const handleSetHandleType = async (handleType: string) => {
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

  useEffect(() => {
    if (!isOpenedStyleSidebar) return;
    if (!selectedProducts.length) return;
    if (
      selectedDimensions.height === null ||
      selectedDimensions.depth === null ||
      selectedDimensions.width === null
    ) {
      return;
    }

    setConfigBatch(selectedProducts, {
      Height: selectedDimensions.height,
      Depth: selectedDimensions.depth,
    });
  }, [selectedDimensions, selectedProducts, isOpenedStyleSidebar]);

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
  }, [dispatch, selectedProductConfig]);

  // Show plus buttons when the sidebar is opened.
  useEffect(() => {
    setVisibleButtons(isOpenedStyleSidebar);

    return () => {
      setVisibleButtons(false);
    };
  }, [isOpenedStyleSidebar]);

  // Close sidebar when clicking outside of it.
  useEffect(() => {
    if (!isOpenedStyleSidebar) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!sidebarRef.current) return;

      const target = event.target as Element | null;
      if (target?.closest?.('[data-filter-menu="true"]')) return;

      if (sidebarRef.current.contains(event.target as Node)) return;

      dispatch(setOpenStyleSidebar(false));
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch, isOpenedStyleSidebar]);

  // Set the product to the desired side (left/right).
  useEffect(() => {
    if (!isPlayCanvasReady) return;

    const onPlusClick = async (entityId: string, side: "left" | "right") => {
      console.log("Clicked Plus Button", entityId, side);

      if (!activeDrawerProduct) return;

      const productId = await setProductByParams(activeDrawerProduct, entityId, side);

      if (!productId) return;

      if (productConfig) {
        await setConfig(productId, productConfig);
      }

      const storedConfig = await getConfig(productId);
      console.log("[RightCabinetStyleSidebar] stored config", storedConfig);

      dispatch(addProductId(productId));

      // Close sidebar and reset accordion to default state
      dispatch(setOpenStyleSidebar(false));
      if (onProductAdded) {
        onProductAdded();
      }
    };

    setHandleButtonClick(onPlusClick);
  }, [isPlayCanvasReady, activeDrawerProduct, productConfig, dispatch, onProductAdded]);

  return (
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
              onSelect={(value) => handleSetHandleType(String(value))}
            />
          </div>
        )}

        {!handlesDisabled && (
          <div className={s.image}>
            <img src={handleImage} alt="handle preview" />
          </div>
        )}
      </div>

      {/* <div className={s.tempButtons}>
        <BaseButton onClick={addToLeft}>Left</BaseButton>
        <BaseButton onClick={addToRight}>Right</BaseButton>
      </div> */}
      <div className={s.bottomText}>
        Click <span className={s.plusButtonIcon}> + </span> button to place your cabinet
      </div>
    </div>
  );
};
