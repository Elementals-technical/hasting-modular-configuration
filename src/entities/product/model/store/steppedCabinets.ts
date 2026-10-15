import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { selectOption } from "@/entities/collection";
import { findPlacedCabinetRule } from "@/features/configurator-rule-core/cabinetBuilder";
import { isSteppedDrawers } from "@/shared/config/configurator/typeCabinetCatalog";

/**
 * Placed cabinets of a drawer style that stands at a height of its own (`ruleData.steppedModules`:
 * the Urban Freestanding 1 Drawer Short). The composition's height is that of the other cabinets;
 * these keep their own, so a check that every cabinet has the composition's size leaves them out.
 */

const NO_IDS: string[] = [];

const getCatalog = (state: RootState) => state.rootStateUI.product.cabinetCatalog;
const getPlacedStyles = (state: RootState) => state.rootStateUI.product.placedCabinetStyles;
const getProductIds = (state: RootState) => state.rootStateUI.product.productIds;
const getProfile = (state: RootState) => state.rootStateUI.product.activeProfile;

export const selectSteppedCabinetIds = createSelector(
  [getCatalog, getPlacedStyles, getProductIds],
  (catalog, placedStyles, productIds): string[] => {
    const stepped = productIds.filter((runtimeId) =>
      isSteppedDrawers(findPlacedCabinetRule(catalog, runtimeId), placedStyles[runtimeId] ?? null),
    );
    return stepped.length > 0 ? stepped : NO_IDS;
  },
);

/**
 * Whether a cabinet of the CabinetType category (`drawer-cabinet`) that is not stepped is placed:
 * a stepped style stands beside such a cabinet, so it needs one first.
 */
export const selectHasPlacedCabinetOfCategory = (state: RootState, category: string): boolean => {
  const catalog = getCatalog(state);
  const profile = getProfile(state);
  const stepped = selectSteppedCabinetIds(state);

  return getProductIds(state).some((runtimeId) => {
    if (stepped.includes(runtimeId)) return false;
    const rule = findPlacedCabinetRule(catalog, runtimeId);
    return Boolean(rule && selectOption(profile, "CabinetType", rule.code)?.category === category);
  });
};
