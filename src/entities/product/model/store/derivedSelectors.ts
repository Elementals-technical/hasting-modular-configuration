import { createSelector } from "@reduxjs/toolkit";

import {
  bookMatchingRule,
  flutingRule,
  grainDirectionRule,
  sidePanelAvailabilityRule,
  sidePanelCountertopLengthRule,
  sidePanelSpecRule,
  syntesiSidePanelRule,
} from "@/features/configurator-rule-core/options";

import {
  getActiveCabinetType,
  getActiveCountertopColor,
  getCabinetColorFinish,
  getCabinetColorMaterial,
  getGrainDirection,
  getSelectedProductConfig,
  getSelectedDimensions,
  getSelectedProducts,
  getSidePanelsOption,
} from "./selectors";

export const selectGrainDirectionState = createSelector(
  [getCabinetColorMaterial, getCabinetColorFinish],
  (material, finish) => grainDirectionRule({ material, finish }),
);

export const selectBookMatchingState = createSelector(
  [getGrainDirection, getSelectedProducts],
  (grainDirection, productIds) => bookMatchingRule({ grainDirection, cabinetCount: productIds.length }),
);

export const selectFlutingState = createSelector(
  [getActiveCabinetType, getCabinetColorMaterial, getSelectedProductConfig],
  (activeCabinetType, cabinetMaterial, selectedProductConfig) => {
    const isOpenShelf = activeCabinetType === "Open-Shelf" || activeCabinetType === "Side-Shelf";
    const drawers = typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
    return flutingRule({
      targetPart: "CABINET",
      cabinetType: activeCabinetType,
      isOpenShelf,
      material: cabinetMaterial,
      drawers,
    });
  },
);

export const selectSidePanelSpecs = createSelector(
  [getSidePanelsOption, getSelectedDimensions],
  (sidePanels, dimensions) =>
    sidePanelSpecRule({ sidePanels, cabinetHeight: dimensions.height, cabinetDepth: dimensions.depth }),
);

const mapCabinetTypeToGroup = (cabinetType?: string | null) => {
  if (!cabinetType) return null;

  if (cabinetType === "Open-Shelf" || cabinetType === "Side-Shelf" || cabinetType === "OS") return "OS";

  if (
    cabinetType === "Sink-Base" ||
    cabinetType === "Sink-Cabinet" ||
    cabinetType === "Side-Cabinet" ||
    cabinetType === "SB" ||
    cabinetType === "SC" ||
    cabinetType === "SBSC"
  ) {
    return "SBSC";
  }
  return null;
};

const mapDrawersToHandleType = (drawers?: string | null) => {
  if (!drawers) return null;

  if (drawers === "1D" || drawers === "1DWID" || drawers === "1" || drawers === "1+inner") return "1D";

  if (drawers === "2D" || drawers === "2") return "2D";
  return null;
};

export const selectSidePanelAvailability = createSelector(
  [getActiveCabinetType, getSelectedProductConfig, getSelectedDimensions],
  (cabinetType, selectedProductConfig, dimensions) => {
    const configName = typeof selectedProductConfig?.name === "string" ? selectedProductConfig.name : null;
    const cabinetGroup = mapCabinetTypeToGroup(cabinetType ?? configName);
    const drawers = typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
    const handleType = mapDrawersToHandleType(drawers);
    const height =
      typeof dimensions.height === "number"
        ? dimensions.height
        : typeof selectedProductConfig?.Height === "number"
          ? selectedProductConfig.Height
          : null;
    return sidePanelAvailabilityRule({ height, handleType, cabinetType: cabinetGroup });
  },
);

export const selectCountertopAdjustedLength = createSelector(
  [getSidePanelsOption, getSelectedDimensions],
  (sidePanels, dimensions) => sidePanelCountertopLengthRule({ sidePanels, vanityLength: dimensions.width }),
);

export const selectSyntesiConstraint = createSelector(
  [getSidePanelsOption, getActiveCountertopColor],
  (sidePanels, countertopMaterial) => syntesiSidePanelRule({ sidePanels, countertopMaterial }),
);
