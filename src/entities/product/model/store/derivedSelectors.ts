import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";

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

/** The rules read their lists and limits from the active collection's profile. */
const getActiveProfile = (state: RootState) => state.rootStateUI.product.activeProfile;

export const selectGrainDirectionState = createSelector(
  [getCabinetColorMaterial, getCabinetColorFinish, getActiveProfile],
  (material, finish, profile) => grainDirectionRule({ material, finish }, profile),
);

export const selectBookMatchingState = createSelector(
  [
    getGrainDirection,
    getSelectedProducts,
    getProductsPresets,
    getHasBootstrappedCabinetBuilder,
    getPlacedCabinetStyles,
    getActiveProfile,
  ],
  (grainDirection, productIds, productsPresets, hasBootstrappedCabinetBuilder, placedCabinetStyles, profile) => {
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

    return bookMatchingRule(
      {
        grainDirection,
        cabinets,
      },
      profile,
    );
  },
);

export const selectFlutingState = createSelector(
  [getActiveCabinetType, getCabinetColorMaterial, getActiveProfile],
  (activeCabinetType, cabinetMaterial, profile) => {
    console.log("[Fluting] inputs", {
      cabinetType: activeCabinetType,
      material: cabinetMaterial,
    });
    return flutingRule(
      {
        targetPart: "CABINET",
        cabinetType: activeCabinetType,
        material: cabinetMaterial,
      },
      profile,
    );
  },
);

export const selectSidePanelSpecs = createSelector(
  [getSidePanelsOption, getSelectedDimensions, getActiveProfile],
  (sidePanels, dimensions, profile) =>
    sidePanelSpecRule({ sidePanels, cabinetHeight: dimensions.height, cabinetDepth: dimensions.depth }, profile),
);

export const selectCountertopAdjustedLength = createSelector(
  [getSidePanelsOption, getSelectedDimensions, getActiveProfile],
  (sidePanels, dimensions, profile) =>
    sidePanelCountertopLengthRule({ sidePanels, vanityLength: dimensions.width }, profile),
);

export const selectCountertopCabinetCompositionConstraint = createSelector(
  [getCountertopColorSku, getSelectedProducts, getActiveProfile],
  (countertopColorSku, selectedProducts, profile) =>
    resolveCountertopCabinetCompositionConstraint({
      materialTokens: getCountertopMaterialTokensBySku(countertopColorSku),
      cabinetCount: selectedProducts.length,
      profile,
    }),
);

export const selectSyntesiConstraint = createSelector(
  [getSidePanelsOption, getCountertopColorSku, getActiveProfile],
  (sidePanels, countertopColorSku, profile) =>
    syntesiSidePanelRule(
      {
        sidePanels,
        countertopMaterial: getCountertopMaterialTokensBySku(countertopColorSku)[0] ?? null,
      },
      profile,
    ),
);
