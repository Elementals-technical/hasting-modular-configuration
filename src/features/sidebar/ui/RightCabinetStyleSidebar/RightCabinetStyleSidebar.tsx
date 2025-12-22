import { useEffect, useMemo, useRef } from "react";

import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import image from "../../../../shared/assets/images/png/img_png.png";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getIsActiveStyleSidebar } from "../../model/store/selectors";
import { setOpenStyleSidebar } from "../../model/store/slice";
import {
  getDimensionOptions,
  getDrawerProduct,
  getCabinetColor,
  getHandleGrooveColor,
  getActiveCountertopColor,
  getSelectedDimensions,
  getSelectedProducts,
  getSelectedProductConfig,
} from "@/entities/product/model/store/selectors";
import { addProductId, setSelectedDimensions, setSelectedProductConfig } from "@/entities/product/model/store/slice";

import s from "./RightCabinetStyleSidebar.module.scss";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { addProductByLeft } from "@/utils/functions/playcanvas/addProductByLeft";
import { addProductByRight } from "@/utils/functions/playcanvas/addProductByRight";
import { setVisibleButtons } from "@/utils/functions/playcanvas/setVisibleButtons";
import { setHandleButtonClick } from "@/utils/functions/playcanvas/setHandleButtonClick";
import { usePlayCanvasReady } from "@/shared/hooks/usePlayCanvasReady";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";

export const RightCabinetStyleSidebar = () => {
  const dispatch = useAppDispatch();
  const isOpenedStyleSidebar = useAppSelector(getIsActiveStyleSidebar);
  const isPlayCanvasReady = usePlayCanvasReady();
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const dimensionOptions = useAppSelector(getDimensionOptions);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeDrawerProduct = useAppSelector(getDrawerProduct);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const countertopColor = useAppSelector(getActiveCountertopColor);

  const handleOptions = useMemo(
    () =>
      dimensionOptions.handles?.length
        ? dimensionOptions.handles
        : [
            { label: "Push to open", value: "handle_pto" },
            { label: "Upper Groove", value: "handle_urban_topcut" },
            { label: "Central Groove", value: "handle_urban_botcut" },
          ],
    [dimensionOptions.handles],
  );

  const productConfig = useMemo(
    () => ({
      ...(selectedProductConfig ?? {}),
      Width: selectedDimensions.width,
      Height: selectedDimensions.height,
      Depth: selectedDimensions.depth,
      CabinetColor: cabinetColor,
      CountertopColor: countertopColor,
      HandleGrooveColor: handleGrooveColor,
    }),
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

  const handleChangeHeight = (value: string | number) => {
    dispatch(setSelectedDimensions({ height: Number(value) }));
  };

  const handleSetHandleType = (handleType: string) => {
    dispatch(
      setSelectedProductConfig({
        ...(selectedProductConfig ?? {}),
        Handle: handleType,
      }),
    );
  };

  useEffect(() => {
    if (!selectedProducts.length) return;

    setConfigBatch(selectedProducts, {
      Height: selectedDimensions.height,
      Depth: selectedDimensions.depth,
    });
  }, [selectedDimensions, selectedProducts]);

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

      const productId =
        side === "left" ? await addProductByLeft(activeDrawerProduct) : await addProductByRight(activeDrawerProduct);

      if (!productId) return;

      await setConfig(productId, productConfig);
      dispatch(addProductId(productId));
    };

    setHandleButtonClick(onPlusClick);
  }, [isPlayCanvasReady, activeDrawerProduct, productConfig, dispatch]);

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
            value={selectedDimensions.width}
            onSelect={(value) => handleChangeWidth(value)}
          />
        </div>

        <div className={s.contentItem}>
          <div>Depth</div>
          <FilterSelection
            label={"Depth"}
            options={dimensionOptions.depth}
            value={selectedDimensions.depth}
            onSelect={(value) => handleChangeDepth(value)}
          />
        </div>

        <div className={s.contentItem}>
          <div>Height</div>
          <FilterSelection
            label={"Height"}
            options={dimensionOptions.height}
            value={selectedDimensions.height}
            onSelect={(value) => handleChangeHeight(value)}
          />
        </div>

        <div className={s.contentItem}>
          <div>Handle</div>
          <FilterSelection
            label={"Handle"}
            options={handleOptions}
            value={selectedProductConfig?.Handle as string | undefined}
            onSelect={(value) => handleSetHandleType(String(value))}
          />
        </div>

        <div className={s.image}>
          <img src={image} alt="image" />
        </div>
      </div>

      {/* <div className={s.tempButtons}>
        <BaseButton onClick={addToLeft}>Left</BaseButton>
        <BaseButton onClick={addToRight}>Right</BaseButton>
      </div> */}
      <div className={s.bottomText}>Click the + button to place your cabinet</div>
    </div>
  );
};
