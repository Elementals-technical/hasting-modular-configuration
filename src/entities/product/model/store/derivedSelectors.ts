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
  getHasBootstrappedCabinetBuilder,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProducts,
  getSidePanelsOption,
} from "./selectors";

export { selectSidePanelAvailability } from "@/features/sidePanel/model/selectors";

export const selectGrainDirectionState = createSelector(
  [getCabinetColorMaterial, getCabinetColorFinish],
  (material, finish) => grainDirectionRule({ material, finish }),
);

export const selectBookMatchingState = createSelector(
  [getGrainDirection, getSelectedProducts, getProductsPresets, getHasBootstrappedCabinetBuilder],
  (grainDirection, productIds, productsPresets, hasBootstrappedCabinetBuilder) => {
    const cabinets =
      productIds.length > 0 || hasBootstrappedCabinetBuilder
        ? productIds.map((productId) => ({ name: productId }))
        : productsPresets.map((preset) => ({ name: preset.name }));

    return bookMatchingRule({
      grainDirection,
      cabinets,
    });
  },
);

export const selectFlutingState = createSelector(
  [getActiveCabinetType, getCabinetColorMaterial],
  (activeCabinetType, cabinetMaterial) => {
    console.log("[Fluting] inputs", {
      cabinetType: activeCabinetType,
      material: cabinetMaterial,
    });
    return flutingRule({
      targetPart: "CABINET",
      cabinetType: activeCabinetType,
      material: cabinetMaterial,
    });
  },
);

export const selectSidePanelSpecs = createSelector(
  [getSidePanelsOption, getSelectedDimensions],
  (sidePanels, dimensions) =>
    sidePanelSpecRule({ sidePanels, cabinetHeight: dimensions.height, cabinetDepth: dimensions.depth }),
);

export const selectCountertopAdjustedLength = createSelector(
  [getSidePanelsOption, getSelectedDimensions],
  (sidePanels, dimensions) => sidePanelCountertopLengthRule({ sidePanels, vanityLength: dimensions.width }),
);

export const selectSyntesiConstraint = createSelector(
  [getSidePanelsOption, getActiveCountertopColor],
  (sidePanels, countertopMaterial) => syntesiSidePanelRule({ sidePanels, countertopMaterial }),
);
