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
  getCountertopColorSku,
  getCabinetColorFinish,
  getCabinetColorMaterial,
  getGrainDirection,
  getHasBootstrappedCabinetBuilder,
  getPlacedCabinetStyles,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProducts,
  getSidePanelsOption,
} from "./selectors";
import { getCountertopMaterialTokensBySku } from "@/shared/lib/sku";
import { resolveCountertopCabinetCompositionConstraint } from "@/features/configurator-rule-core/countertop";

export { selectSidePanelAvailability } from "@/features/sidePanel/model/selectors";

export const selectGrainDirectionState = createSelector(
  [getCabinetColorMaterial, getCabinetColorFinish],
  (material, finish) => grainDirectionRule({ material, finish }),
);

export const selectBookMatchingState = createSelector(
  [getGrainDirection, getSelectedProducts, getProductsPresets, getHasBootstrappedCabinetBuilder, getPlacedCabinetStyles],
  (grainDirection, productIds, productsPresets, hasBootstrappedCabinetBuilder, placedCabinetStyles) => {
    const cabinets =
      productIds.length > 0 || hasBootstrappedCabinetBuilder
        ? productIds.map((productId) => ({
            name: productId,
            drawers: placedCabinetStyles[productId] ?? null,
          }))
        : productsPresets.map((preset) => ({
            name: preset.name,
            drawers: preset.Drawers ?? null,
          }));

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

export const selectCountertopCabinetCompositionConstraint = createSelector(
  [getCountertopColorSku, getSelectedProducts],
  (countertopColorSku, selectedProducts) =>
    resolveCountertopCabinetCompositionConstraint({
      materialTokens: getCountertopMaterialTokensBySku(countertopColorSku),
      cabinetCount: selectedProducts.length,
    }),
);

export const selectSyntesiConstraint = createSelector(
  [getSidePanelsOption, getCountertopColorSku],
  (sidePanels, countertopColorSku) =>
    syntesiSidePanelRule({
      sidePanels,
      countertopMaterial: getCountertopMaterialTokensBySku(countertopColorSku)[0] ?? null,
    }),
);
