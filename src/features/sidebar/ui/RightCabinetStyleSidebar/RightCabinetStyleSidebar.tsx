import { ArrowRight } from "@/shared/assets/images/svg/ArrowRight";

import { FilterSelection } from "@/shared/ui/Filter/FilterSelection";
import image from "../../../../shared/assets/images/png/img_png.png";

import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { getIsActiveStyleSidebar } from "../../model/store/selectors";
import { setOpenStyleSidebar } from "../../model/store/slice";
import {
  getDimensionOptions,
  getDrawerProduct,
  getSelectedDimensions,
  getSelectedProducts,
} from "@/entities/product/model/store/selectors";
import { addProductId, setSelectedDimensions } from "@/entities/product/model/store/slice";

import s from "./RightCabinetStyleSidebar.module.scss";
import { useEffect } from "react";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import { BaseButton } from "@/shared";
import { addProductByLeft } from "@/utils/functions/playcanvas/addProductByLeft";
import { setConfig } from "@/utils/functions/playcanvas/setConfig";
import { addProductByRight } from "@/utils/functions/playcanvas/addProductByRight";

export const RightCabinetStyleSidebar = () => {
  const dispatch = useAppDispatch();
  const isOpenedStyleSidebar = useAppSelector(getIsActiveStyleSidebar);

  const dimensionOptions = useAppSelector(getDimensionOptions);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProducts = useAppSelector(getSelectedProducts);
  const activeDrawerProduct = useAppSelector(getDrawerProduct);

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

  const addToLeft = async () => {
    try {
      const productId = await addProductByLeft(activeDrawerProduct);

      setConfig(productId, { Width: selectedDimensions.width });

      if (productId) {
        dispatch(addProductId(productId));
      }
    } catch (error) {
      console.error("[ProductModelItem] Failed to add product to the left", error);
    }
  };

  const addToRight = async () => {
    try {
      const productId = await addProductByRight(activeDrawerProduct);

      setConfig(productId, { Width: selectedDimensions.width });

      if (productId) {
        dispatch(addProductId(productId));
      }
    } catch (error) {
      console.error("[ProductModelItem] Failed to add product to the right", error);
    }
  };

  useEffect(() => {
    if (!selectedProducts.length) return;

    setConfigBatch(selectedProducts, {
      Height: selectedDimensions.height,
      Depth: selectedDimensions.depth,
    });
  }, [selectedDimensions, selectedProducts]);

  return (
    <div className={`${s.cabinetStyleSidebar} ${isOpenedStyleSidebar ? s.active : ""}`}>
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

        <div className={s.image}>
          <img src={image} alt="image" />
        </div>
      </div>

      <div className={s.tempButtons}>
        <BaseButton onClick={addToLeft}>Left</BaseButton>
        <BaseButton onClick={addToRight}>Right</BaseButton>
      </div>
      <div className={s.bottomText}>Click the + button to place your cabinet</div>
    </div>
  );
};
