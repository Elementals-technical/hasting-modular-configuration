import { useState } from "react";

import { BaseButton } from "@/shared";
import { DimentionsIcon } from "@/shared/assets/images/svg/DimentionsIcon";
import { ZoomInIcon } from "@/shared/assets/images/svg/ZoomInIcon";
import { ZoomOutIcon } from "@/shared/assets/images/svg/ZoomOutIcon";
import { ArIcon } from "@/shared/assets/images/svg/ArIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { RotateIcon } from "@/shared/assets/images/svg/RotateIcon";
import { useLocation } from "react-router-dom";

import { removeAllProducts } from "@/utils/functions/playcanvas/removeAllProducts";
import {
  addProductId,
  addProductPreset,
  resetPrebuiltProducts,
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
import { addPreset } from "@/utils/functions/playcanvas/addPreset";
import { productMockData } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";
// import { downloadArFiles } from "@/utils/functions/playcanvas/downloadArFiles";
import { useSaveConfigurationMutation } from "@/entities";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { ArPopup } from "@/shared/ui/Popups/ui/ArPopup/ArPopup";

import s from "./BottomCanvasButtons.module.scss";

export const BottomCanvasButtons = () => {
  const [isOpening, setIsOpening] = useState(false);

  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const isCustomRoute = pathname.includes("/custom");

  const [saveConfiguration] = useSaveConfigurationMutation();

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

  const resetPrebuiltScene = async () => {
    removeAllProducts();
    dispatch(resetPrebuiltProducts());

    try {
      await addPreset(productMockData[0].presetProducts);

      dispatch(addProductPreset(productMockData[0].presetProducts));
    } catch (error) {
      console.log(error);
    }
  };

  const handleSaveConfiguration = async () => {
    const ids = getOrderedProductIds();

    if (!ids.length) {
      console.warn("[Configurations] No products to save");
      return;
    }

    const configs = await Promise.all(ids.map((id) => getConfig(id)));
    const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
      acc[id] = configs[index];
      return acc;
    }, {});

    const metadata = {
      path: pathname,
      savedAt: new Date().toISOString(),
    };

    try {
      await saveConfiguration({ configuration, metadata }).unwrap();
      console.log("[Configurations] Saved");
    } catch (error) {
      console.error("[Configurations] Save failed", error);
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

      <BaseButton
        variant="ghost"
        onClick={() => {
          // downloadArFiles();
          // handleSaveConfiguration();
          setIsOpening(true);
        }}
      >
        <ArIcon />
      </BaseButton>

      <ArPopup isOpening={isOpening} setIsOpening={setIsOpening} />

      <BaseButton variant="ghost">
        <ShareIcon />
      </BaseButton>

      <BaseButton
        variant="ghost"
        onClick={() => {
          if (isCustomRoute) {
            resetCustomBuilderScene();
          } else {
            resetPrebuiltScene();
          }
        }}
      >
        <RotateIcon />
      </BaseButton>
    </div>
  );
};
