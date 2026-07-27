import { useCallback } from "react";
import { useLocation } from "react-router-dom";

import { useSaveConfigurationMutation } from "@/entities";
import {
  getActiveCountertopColor,
  getActiveCountertopThickness,
  getBookMatching,
  getCabinetColor,
  getCountertopColorSku,
  getCountertopStyle,
  getDividersOption,
  getDividersStyle,
  getDrawerPanelFluting,
  getFaucetHolesAmount,
  getFaucetHolesSpacing,
  getGrainDirection,
  getHandleGrooveColor,
  getLedOption,
  getSelectedProducts,
  getSidePanelLeftStatus,
  getSidePanelRightStatus,
  getSidePanelsOption,
  getSinkType,
  getTowelBarColor,
  getTowelBarOption,
  getVesselColor,
} from "@/entities/product/model/store/selectors";
import {
  getHasSubmittedCart,
  getIsAutofillEnabled,
  getManualSelectedMaterials,
  getSelectedMaterials,
} from "@/features/swatchOrder";
import { useAppSelector } from "@/shared/hooks/store/redux";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

import { buildConfigurationMetadata } from "../lib/buildConfigurationMetadata";
import { buildConfigurationShareUrl } from "../lib/buildConfigurationShareUrl";
import { resolveConfigurationIdFromSearch } from "../lib/configurationUrlParams";

export type CurrentConfigurationLink = {
  id: string;
  url: string;
};

export const useCurrentConfigurationLink = () => {
  const location = useLocation();
  const [saveConfiguration] = useSaveConfigurationMutation();

  const selectedProducts = useAppSelector(getSelectedProducts);
  const cabinetColor = useAppSelector(getCabinetColor);
  const handleGrooveColor = useAppSelector(getHandleGrooveColor);
  const sinkType = useAppSelector(getSinkType);
  const countertopColor = useAppSelector(getActiveCountertopColor);
  const countertopColorSku = useAppSelector(getCountertopColorSku);
  const vesselColor = useAppSelector(getVesselColor);
  const countertopThickness = useAppSelector(getActiveCountertopThickness);
  const drawerPanelFluting = useAppSelector(getDrawerPanelFluting);
  const grainDirection = useAppSelector(getGrainDirection);
  const bookMatching = useAppSelector(getBookMatching);
  const countertopStyle = useAppSelector(getCountertopStyle);
  const sidePanelsOption = useAppSelector(getSidePanelsOption);
  const sidePanelLeft = useAppSelector(getSidePanelLeftStatus);
  const sidePanelRight = useAppSelector(getSidePanelRightStatus);
  const ledOption = useAppSelector(getLedOption);
  const dividersOption = useAppSelector(getDividersOption);
  const dividersStyle = useAppSelector(getDividersStyle);
  const towelBarOption = useAppSelector(getTowelBarOption);
  const towelBarColor = useAppSelector(getTowelBarColor);
  const faucetHolesAmount = useAppSelector(getFaucetHolesAmount);
  const faucetHolesSpacing = useAppSelector(getFaucetHolesSpacing);
  const selectedMaterials = useAppSelector(getSelectedMaterials);
  const manualSelectedMaterials = useAppSelector(getManualSelectedMaterials);
  const isAutofillEnabled = useAppSelector(getIsAutofillEnabled);
  const hasSubmittedCart = useAppSelector(getHasSubmittedCart);

  const createCurrentConfigurationLink = useCallback(async (): Promise<CurrentConfigurationLink> => {
    const existingConfigId = resolveConfigurationIdFromSearch(location.search);
    if (existingConfigId) {
      return {
        id: existingConfigId,
        url: buildConfigurationShareUrl(existingConfigId),
      };
    }

    const ids = getOrderedProductIds(selectedProducts);
    if (!ids.length) {
      throw new Error("No products to save");
    }

    const configs = await Promise.all(ids.map((id) => getConfig(id)));
    const configuration = ids.reduce<Record<string, unknown>>((acc, id, index) => {
      acc[id] = configs[index];
      return acc;
    }, {});

    const metadata = buildConfigurationMetadata({
      path: location.pathname,
      orderedProductIds: ids,
      uiState: {
        CabinetColor: cabinetColor,
        HandleGrooveColor: handleGrooveColor,
        sinkType,
        CountertopColor: countertopColor,
        CountertopColorSku: countertopColorSku,
        VesselColor: vesselColor,
        Thickness: countertopThickness,
        DrawerPanelFluting: drawerPanelFluting,
        GrainDirection: grainDirection,
        BookMatching: bookMatching,
        CountertopStyle: countertopStyle,
        SidePanels: sidePanelsOption,
        SidePanelLeft: sidePanelLeft,
        SidePanelRight: sidePanelRight,
        LedOption: ledOption,
        DividersOption: dividersOption,
        DividersStyle: dividersStyle,
        TowelBarOption: towelBarOption,
        TowelBarColor: towelBarColor,
        FaucetHolesAmount: faucetHolesAmount,
        FaucetHolesSpacing: faucetHolesSpacing,
      },
      swatchOrder: {
        selectedMaterials,
        manualSelectedMaterials,
        isAutofillEnabled,
        hasSubmittedCart,
      },
    });

    const result = await saveConfiguration({ configuration, metadata }).unwrap();
    const configId = result?.id;
    if (configId === undefined || configId === null) {
      throw new Error("Saved configuration response is missing id");
    }

    return {
      id: String(configId),
      url: buildConfigurationShareUrl(configId),
    };
  }, [
    bookMatching,
    cabinetColor,
    countertopColor,
    countertopColorSku,
    countertopStyle,
    countertopThickness,
    dividersOption,
    dividersStyle,
    drawerPanelFluting,
    faucetHolesAmount,
    faucetHolesSpacing,
    grainDirection,
    handleGrooveColor,
    hasSubmittedCart,
    isAutofillEnabled,
    ledOption,
    location.pathname,
    location.search,
    manualSelectedMaterials,
    saveConfiguration,
    selectedMaterials,
    selectedProducts,
    sidePanelLeft,
    sidePanelRight,
    sidePanelsOption,
    sinkType,
    towelBarColor,
    towelBarOption,
    vesselColor,
  ]);

  return { createCurrentConfigurationLink };
};
