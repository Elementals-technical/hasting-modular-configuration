import { createSelector } from "@reduxjs/toolkit";

import {
  bookMatchingRule,
  flutingRule,
  grainDirectionRule,
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

export const selectFlutingState = createSelector([getActiveCabinetType], (activeCabinetType) => {
  const isOpenShelf = activeCabinetType === "Open-Shelf" || activeCabinetType === "Side-Shelf";
  return flutingRule({ targetPart: "CABINET", cabinetType: activeCabinetType, isOpenShelf });
});

export const selectSidePanelSpecs = createSelector(
  [getSidePanelsOption, getSelectedDimensions],
  (sidePanels, dimensions) =>
    sidePanelSpecRule({ sidePanels, cabinetHeight: dimensions.height, cabinetDepth: dimensions.depth }),
);

export const selectCountertopAdjustedLength = createSelector(
  [getSidePanelsOption, getSelectedDimensions],
  (sidePanels, dimensions) =>
    sidePanelCountertopLengthRule({ sidePanels, vanityLength: dimensions.width }),
);

export const selectSyntesiConstraint = createSelector(
  [getSidePanelsOption, getActiveCountertopColor],
  (sidePanels, countertopMaterial) => syntesiSidePanelRule({ sidePanels, countertopMaterial }),
);
