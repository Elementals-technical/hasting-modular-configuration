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

/**
 * The drawers value the placed composition stands for, or null while nothing is placed.
 *
 * Styles of different `drawerStyleGroups` cannot be mixed, so every placed cabinet normally
 * belongs to one group and any of its values names the composition. A legacy configuration that
 * did mix them is resolved by the later group, as the `single` / `double` predecessor resolved
 * it. A collection that declares no groups has nothing to choose between.
 */
export const getDominantDrawerValue = createSelector(
  [getPlacedCabinetStyles, getActiveProfile],
  (placedCabinetStyles, profile): string | null => {
    const placed = Object.values(placedCabinetStyles);
    if (placed.length === 0) return null;

    const groups = profile?.ruleData.drawerStyleGroups;
    if (!groups?.length) return placed[0] ?? null;

    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const found = placed.find((value) => groups[index]?.includes(value));
      if (found) return found;
    }

    return null;
  },
);

/**
 * Attribute values the active collection's `optionImageVariants` rows are matched against.
 *
 * Two stores hold them: the typed product options, and the configuration slice for attributes
 * that left the typed core — Mako's `LegColor` and `HandleColor` live only there. A cabinet-scoped
 * attribute counts as set as soon as one cabinet has it, which is what "this composition has
 * legs" means for a card.
 *
 * The cabinet type, the drawers the composition stands for and the selected height are named
 * here because they are not attributes of the typed options.
 */
export const selectOptionImageContext = createSelector(
  [
    (state: RootState) => state.rootStateUI.product.productOptions,
    (state: RootState) => state.rootStateUI.configuration.valuesByAttributeId,
    getActiveCabinetType,
    getDominantDrawerValue,
    getSelectedDimensions,
  ],
  (productOptions, valuesByAttributeId, cabinetType, drawers, dimensions): Record<string, string> => {
    const context: Record<string, string> = {};

    for (const [attributeId, value] of Object.entries(productOptions)) {
      context[attributeId] = typeof value === "string" ? value : String(value ?? "");
    }

    for (const [attributeId, values] of Object.entries(valuesByAttributeId)) {
      const set = values.find((entry) => typeof entry.value === "string" && entry.value.trim().length > 0);
      context[attributeId] = typeof set?.value === "string" ? set.value : "";
    }

    context.CabinetType = cabinetType ?? "";
    context.Drawers = drawers ?? "";
    context.Height = dimensions.height === null ? "" : String(dimensions.height);

    return context;
  },
);
