import { useContext, useMemo } from "react";

import { ActiveCollectionContext } from "@/entities/collection";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import {
  getActiveProductProfile,
  getCabinetEntries,
  getDimensionsByCabinet,
} from "@/entities/configuration/model/store/selectors";
import {
  getActiveCabinetType,
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getBookMatching,
  getCabinetCatalog,
  getCabinetColor,
  getCabinetColorSku,
  getCountertopColorSku,
  getCountertopStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getGrainDirection,
  getHandleGrooveColor,
  getHandleGrooveColorSku,
  getHasBootstrappedCabinetBuilder,
  getPlacedCabinetStyles,
  getPlacedDividers,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProductConfig,
  getSelectedProducts,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSidePanelsOption,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import { useCountertopRules } from "@/features/configurator-rule-core/countertop";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { useSceneProductConfigs } from "@/shared/hooks/useSceneProductConfigs";
import { useSkuBuilders } from "@/shared/hooks/useSkuBuilders";
import { buildColorSkuMaps, type PricingInput } from "@/shared/lib/pricing";
import { shouldUsePresetProducts } from "@/shared/lib/shouldUsePresetProducts";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

const NO_CONFIGURATOR_GROUPS: ConfiguratorAvailableOption[] = [];

/**
 * The inputs of the order lines (D02): A's collection data, C's state and the scene configs.
 *
 * The configurator colours and the countertop rules come from the active collection rather
 * than their own requests, so the price reads the same data as every other consumer.
 */
export const usePricingInput = () => {
  const skuBuilders = useSkuBuilders();
  const collection = useContext(ActiveCollectionContext);
  const configuratorGroups =
    collection?.status === "ready"
      ? (collection.data.catalog.configurator?.groups ?? NO_CONFIGURATOR_GROUPS)
      : NO_CONFIGURATOR_GROUPS;
  const colorSkuMaps = useMemo(() => buildColorSkuMaps(configuratorGroups), [configuratorGroups]);
  const countertopRules = useCountertopRules();
  const { sceneConfigs, refresh: refreshSceneConfigs } = useSceneProductConfigs();

  const activeProfile = useAppSelector(getActiveProductProfile);
  const cabinetCatalog = useAppSelector(getCabinetCatalog);
  const productIds = useAppSelector(getSelectedProducts);
  const productsPresets = useAppSelector(getProductsPresets);
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);
  const cabinetEntries = useAppSelector(getCabinetEntries);
  const dimensionsByCabinet = useAppSelector(getDimensionsByCabinet);
  const activeCabinetType = useAppSelector(getActiveCabinetType);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const selectedProductConfig = useAppSelector(getSelectedProductConfig);
  const placedDividers = useAppSelector(getPlacedDividers);
  const placedCabinetStyles = useAppSelector(getPlacedCabinetStyles);

  const cabinetColor = useAppSelector(getCabinetColor);
  const cabinetColorSku = useAppSelector(getCabinetColorSku);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const handleGrooveColorSku = useAppSelector(getHandleGrooveColorSku);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const vesselColor = useAppSelector(getVesselColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sinkType = useAppSelector(getSinkType);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const bookMatching = useAppSelector(getBookMatching);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);

  const shouldUsePresets = shouldUsePresetProducts({
    productsPresetsCount: productsPresets.length,
    productIdsCount: productIds.length,
    sceneConfigsCount: sceneConfigs.length,
    hasBootstrappedCabinetBuilder,
  });

  const canCalculate = shouldUsePresets
    ? true
    : sceneConfigs.length > 0
      ? true
      : productIds.length === 0 && selectedDimensions.width !== null;

  const input = useMemo<PricingInput>(
    () => ({
      skuBuilders,
      activeProfile,
      colorSkuMaps,
      countertopRules,
      cabinetCatalog,
      shouldUsePresets,
      productIds,
      // The scene's composition order at the time the lines are built.
      orderedProductIds: getOrderedProductIds(productIds),
      productsPresets,
      sceneConfigs,
      cabinetEntries,
      dimensionsByCabinet,
      activeCabinetType,
      selectedDimensions,
      selectedProductConfig,
      placedDividers,
      placedCabinetStyles,
      cabinetColor,
      cabinetColorSku,
      handleGrooveColor,
      handleGrooveColorSku,
      countertopColor,
      countertopColorSku,
      vesselColor,
      countertopThickness,
      countertopStyle,
      sinkType,
      drawerPanelFluting,
      grainDirection,
      bookMatching,
      towelBarOption,
      towelBarColor,
      faucetHolesAmount,
      sidePanelsOption,
      sidePanelLeft,
      sidePanelRight,
    }),
    [
      skuBuilders,
      activeProfile,
      colorSkuMaps,
      countertopRules,
      cabinetCatalog,
      shouldUsePresets,
      productIds,
      productsPresets,
      sceneConfigs,
      cabinetEntries,
      dimensionsByCabinet,
      activeCabinetType,
      selectedDimensions,
      selectedProductConfig,
      placedDividers,
      placedCabinetStyles,
      cabinetColor,
      cabinetColorSku,
      handleGrooveColor,
      handleGrooveColorSku,
      countertopColor,
      countertopColorSku,
      vesselColor,
      countertopThickness,
      countertopStyle,
      sinkType,
      drawerPanelFluting,
      grainDirection,
      bookMatching,
      towelBarOption,
      towelBarColor,
      faucetHolesAmount,
      sidePanelsOption,
      sidePanelLeft,
      sidePanelRight,
    ],
  );

  return { input, canCalculate, refreshSceneConfigs };
};
