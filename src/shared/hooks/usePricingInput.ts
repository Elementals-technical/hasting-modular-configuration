import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import {
  getActiveProductProfile,
  getCabinetEntries,
  getDimensionsByCabinet,
  getValuesByAttributeId,
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

/**
 * The inputs of the order lines (D02): A's collection data, C's state and the scene configs.
 *
 * The configurator colours and the countertop rules come from the active collection rather
 * than their own requests, so the price reads the same data as every other consumer.
 */
export const usePricingInput = () => {
  const skuBuilders = useSkuBuilders();
  const configuratorGroups = useActiveCollection((collection) => collection.catalog.configurator.groups);
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
  const configurationValues = useAppSelector(getValuesByAttributeId);
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

  // Nothing placed yet, but a cabinet with a size is chosen: USH prices that one cabinet.
  const hasOnlySelectedCabinet = productIds.length === 0 && selectedDimensions.width !== null;

  // A collection priced from its SKU profile reads C's cabinets (D04); USH reads its presets or the scene.
  const canCalculate =
    skuBuilders.status === "collection"
      ? cabinetEntries.length > 0
      : shouldUsePresets || sceneConfigs.length > 0 || hasOnlySelectedCabinet;

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
      configurationValues,
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
      configurationValues,
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
