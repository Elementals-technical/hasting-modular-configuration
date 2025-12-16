import { BaseButton } from "@/shared";
import { DimentionsIcon } from "@/shared/assets/images/svg/DimentionsIcon";
import { ZoomInIcon } from "@/shared/assets/images/svg/ZoomInIcon";
import { ZoomOutIcon } from "@/shared/assets/images/svg/ZoomOutIcon";
import { ArIcon } from "@/shared/assets/images/svg/ArIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { RotateIcon } from "@/shared/assets/images/svg/RotateIcon";

import s from "./BottomCanvasButtons.module.scss";
import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import {
  addProductId,
  resetProducts,
  setActiveBasinStyle,
  setActiveCabinetType,
  setDrawerProduct,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";
import { addProduct, type addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { optionsMockData } from "@/pages/custom/cabinetBuilder/constants";

export const BottomCanvasButtons = () => {
  const dispatch = useAppDispatch();

  const resetCustomBuilderScene = async () => {
    removeAllProducts();
    dispatch(resetProducts());

    const firstCabinetOption = optionsMockData[0];

    const defaultProductName = "Sink-Base";
    const defaultProductConfig: addProductConfigI = {
      Height: 56,
      Depth: 46,
      CabinetColor: "Ardesia DD GL",
      Width: 60,
      sinkType: "Top_HPLPrisma",
      CountertopColor: "Rosso Rubino 19 MT",
      HandleGrooveColor: "Blu Pavone A6 MT",
    };

    if (firstCabinetOption) {
      dispatch(setActiveCabinetType(firstCabinetOption.id));

      const productId = await addProduct(defaultProductName, defaultProductConfig);

      dispatch(setDrawerProduct(defaultProductName));
      dispatch(setSelectedProductConfig(defaultProductConfig));
      dispatch(
        setSelectedDimensions({
          width: defaultProductConfig.Width,
          height: defaultProductConfig.Height,
          depth: defaultProductConfig.Depth,
        }),
      );

      if (defaultProductConfig.sinkType) {
        dispatch(setActiveBasinStyle(defaultProductConfig.sinkType));
      }

      if (productId) {
        dispatch(addProductId(productId));
      }
    }
  };

  return (
    <div className={s.bottomCanvasButtons}>
      <BaseButton variant="ghost">
        <DimentionsIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ZoomInIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ZoomOutIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ArIcon />
      </BaseButton>

      <BaseButton variant="ghost">
        <ShareIcon />
      </BaseButton>

      <BaseButton variant="ghost" onClick={resetCustomBuilderScene}>
        <RotateIcon />
      </BaseButton>
    </div>
  );
};
