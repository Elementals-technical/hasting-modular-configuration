import { useState } from "react";

import { BaseButton } from "@/shared";
import { DimentionsIcon } from "@/shared/assets/images/svg/DimentionsIcon";
import { ZoomInIcon } from "@/shared/assets/images/svg/ZoomInIcon";
import { ZoomOutIcon } from "@/shared/assets/images/svg/ZoomOutIcon";
import { ArIcon } from "@/shared/assets/images/svg/ArIcon";
import { ShareIcon } from "@/shared/assets/images/svg/ShareIcon";
import { RotateIcon } from "@/shared/assets/images/svg/RotateIcon";
import { useLocation, useNavigate } from "react-router-dom";

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
import {
  useCreateArConfigurationMutation,
  useLazyRestoreConfigurationQuery,
  // useSaveConfigurationMutation,
} from "@/entities";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { ArPopup } from "@/shared/ui/Popups/ui/ArPopup/ArPopup";
import { LoaderBlock } from "@/shared/ui/LoaderBlock/LoaderBlock";
import { buildPresetFromConfiguration } from "@/utils/buildPresetFromConfiguration";
import { setConfigBatch } from "@/utils/functions/playcanvas/setConfigBatch";
import type { PresetProduct } from "@/entities/product/types";
import { exportToAR } from "@/utils/functions/playcanvas/exportToAR";

import s from "./BottomCanvasButtons.module.scss";

export const BottomCanvasButtons = () => {
  const [isOpening, setIsOpening] = useState(false);
  const [QRValue, setQRValue] = useState("");

  const dispatch = useAppDispatch();

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCustomRoute = pathname.includes("/custom");

  // const [saveConfiguration] = useSaveConfigurationMutation();
  const [restore, { data, isFetching }] = useLazyRestoreConfigurationQuery();
  const [createArConfiguration, { isLoading: isFetchingArConfig }] = useCreateArConfigurationMutation();

  console.log(data);

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

  // const handleSaveConfiguration = async () => {
  //   const ids = getOrderedProductIds();

  //   if (!ids.length) {
  //     console.warn("[Configurations] No products to save");
  //     return;
  //   }

  //   const configs = await Promise.all(ids.map((id) => getConfig(id)));
  //   const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
  //     acc[id] = configs[index];
  //     return acc;
  //   }, {});

  //   const metadata = {
  //     path: "custom/cabinet-builder",
  //     savedAt: new Date().toISOString(),
  //   };

  //   try {
  //     await saveConfiguration({ configuration, metadata }).unwrap();
  //     console.log("[Configurations] Saved");
  //   } catch (error) {
  //     console.error("[Configurations] Save failed", error);
  //   }
  // };

  const handleCreateArConfiguration = async () => {
    const ids = getOrderedProductIds();

    if (!ids.length) {
      console.warn("[AR] No products to export");
      return;
    }

    const configs = await Promise.all(ids.map((id) => getConfig(id)));
    const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
      acc[id] = configs[index];
      return acc;
    }, {});

    const arExport = await exportToAR("both");
    if (!arExport) {
      console.warn("[AR] Export failed");
      return;
    }

    const timestamp = Date.now();
    const glbFile = arExport.glb
      ? new File([arExport.glb], `configuration_${timestamp}.glb`, { type: arExport.glb.type })
      : undefined;

    const usdzFile = arExport.usdz
      ? new File([arExport.usdz], `configuration_${timestamp}.usdz`, { type: arExport.usdz.type })
      : undefined;

    try {
      const result = await createArConfiguration({
        configuration,
        glb: glbFile,
        usdz: usdzFile,
      }).unwrap();

      const fileUrl = result?.usdzUrl || result?.glbUrl || "";

      const qrValue = fileUrl ? `${window.location.origin}/ar-download?url=${encodeURIComponent(fileUrl)}` : "";

      setQRValue(qrValue);
    } catch (err) {
      console.error("[AR] Failed to create AR configuration", err);
    }
  };

  const handleRestoreConfiguration = async () => {
    try {
      const result = await restore(5).unwrap();

      // Set default path in which the configuration will be restored.
      const path = result?.metadata?.path;
      if (typeof path === "string" && path.startsWith("/")) {
        navigate(path);
      }

      const configuration = result?.configuration || {};
      const presetProducts = buildPresetFromConfiguration(configuration);

      console.log(":presetProducts", presetProducts);

      dispatch(resetProducts());
      removeAllProducts();

      const createdIds = await addPreset(presetProducts);
      dispatch(addProductPreset(presetProducts));

      // @ts-ignore
      const orderedIds = createdIds?.length ? createdIds : getOrderedProductIds();
      orderedIds.forEach((id) => dispatch(addProductId(id)));

      const groupByName = presetProducts.reduce<Record<string, PresetProduct[]>>((acc, item) => {
        const key = item.name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});

      Object.entries(groupByName).forEach(([name, items]) => {
        const [first] = items;
        if (!first) return;

        if (name.startsWith("Top_")) {
          if (first.CountertopColor) {
            setConfigBatch({ productType: name }, { CountertopColor: first.CountertopColor });
          }
          return;
        }

        const config: Record<string, unknown> = {};
        if (first.CabinetColor) config.CabinetColor = first.CabinetColor;
        if (first.HandleGrooveColor) config.HandleGrooveColor = first.HandleGrooveColor;
        if (first.sinkType) config.sinkType = first.sinkType;
        if (first.Drawers) config.Drawers = first.Drawers;

        if (Object.keys(config).length) {
          setConfigBatch({ productType: name }, config);
        }
      });

      const [firstPreset] = presetProducts;
      if (firstPreset?.name) {
        dispatch(setDrawerProduct(firstPreset.name));
      }

      dispatch(setSelectedProductConfig(firstPreset ?? null));

      const nextDimensions: Partial<{
        width: number;
        height: number;
        depth: number;
      }> = {};
      if (typeof firstPreset?.Width === "number") nextDimensions.width = firstPreset.Width;
      if (typeof firstPreset?.Height === "number") nextDimensions.height = firstPreset.Height;
      if (typeof firstPreset?.Depth === "number") nextDimensions.depth = firstPreset.Depth;

      if (Object.keys(nextDimensions).length) {
        dispatch(setSelectedDimensions(nextDimensions));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {isFetching && <LoaderBlock />}

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
            setIsOpening(true);
            handleCreateArConfiguration();
          }}
        >
          <ArIcon />
        </BaseButton>

        <BaseButton variant="ghost" onClick={handleRestoreConfiguration}>
          R
        </BaseButton>

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

        <ArPopup
          isLoadingAr={isFetchingArConfig}
          qrValue={QRValue}
          qrSize={200}
          isOpening={isOpening}
          setIsOpening={setIsOpening}
        />
      </div>
    </>
  );
};
