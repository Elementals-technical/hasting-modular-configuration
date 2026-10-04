import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { selectMessage, selectRuleData } from "@/entities/collection";
import { normalizeMaterialToken } from "@/features/configurator-rule-core/countertop/parse";
import { getCountertopMaterialTokensBySku } from "@/shared/lib/sku";
import { mapSidePanelDrawersToHandleType, sidePanelAvailabilityRule } from "../lib/sidePanelRules";

// ── Plain selectors ────────────────────────────────────────────────────

export const getSidePanelsOption = (state: RootState) => state.rootStateUI.product.productOptions.SidePanels;
export const getSidePanelLeftStatus = (state: RootState) => state.rootStateUI.product.productOptions.SidePanelLeft;
export const getSidePanelRightStatus = (state: RootState) => state.rootStateUI.product.productOptions.SidePanelRight;

// ── Helpers ────────────────────────────────────────────────────────────

export type SidePanelCabinetGroup = "SBSC" | "OS" | "OSS";

const CABINET_GROUPS: readonly SidePanelCabinetGroup[] = ["SBSC", "OS", "OSS"];
const isCabinetGroup = (value: string): value is SidePanelCabinetGroup =>
  (CABINET_GROUPS as readonly string[]).includes(value);

/** A family name ("side-shelf") may sit inside a runtime id; a code without a hyphen ("oss") must match whole. */
const matchesGroupAlias = (value: string, alias: string): boolean => {
  const normalizedAlias = alias.toLowerCase();
  return normalizedAlias.includes("-") ? value.includes(normalizedAlias) : value === normalizedAlias;
};

/** Side panel group of a cabinet, from `ruleData.sidePanels.cabinetGroups` in declaration order. */
export const mapCabinetTypeToGroup = (
  cabinetType: string | null | undefined,
  profile: ProductProfile | null,
): SidePanelCabinetGroup | null => {
  if (!cabinetType) return null;

  const groups = selectRuleData(profile, "sidePanels")?.cabinetGroups;
  if (!groups) return null;

  const value = cabinetType.toLowerCase();
  const group = Object.entries(groups).find(([, aliases]) => aliases.some((alias) => matchesGroupAlias(value, alias)))?.[0];

  return group && isCabinetGroup(group) ? group : null;
};

// ── Derived selectors ──────────────────────────────────────────────────

const getActiveCabinetType = (state: RootState) => state.rootStateUI.product.activeCabinetType;
const getSelectedProductConfig = (state: RootState) => state.rootStateUI.product.selectedProductConfig;
const getSelectedDimensions = (state: RootState) => state.rootStateUI.product.selectedDimensions;
const getSelectedSceneProduct = (state: RootState) => state.rootStateUI.product.selectedSceneProduct;
const getCountertopColorSku = (state: RootState) => state.rootStateUI.product.productOptions.CountertopColorSku;
const getActiveProfile = (state: RootState) => state.rootStateUI.product.activeProfile;

export const selectSidePanelAvailability = createSelector(
  [
    getActiveCabinetType,
    getSelectedProductConfig,
    getSelectedDimensions,
    getSelectedSceneProduct,
    getCountertopColorSku,
    getActiveProfile,
  ],
  (cabinetType, selectedProductConfig, dimensions, selectedSceneProduct, countertopColorSku, profile) => {
    const syntesi = selectRuleData(profile, "syntesi");

    if (syntesi && !syntesi.allowsSidePanels) {
      const syntesiToken = normalizeMaterialToken(syntesi.material);
      const countertopMaterialTokens = getCountertopMaterialTokensBySku(countertopColorSku);

      if (countertopMaterialTokens.some((token) => normalizeMaterialToken(token) === syntesiToken)) {
        return {
          allowed: new Set<"NoG" | "UpperG" | "CenterG" | "DoubleG">(),
          reason: selectMessage(profile, "syntesi.sidePanelsUnavailable"),
          reasonCode: "syntesi-countertop" as const,
        };
      }
    }

    const configName =
      (typeof selectedProductConfig?.name === "string" && selectedProductConfig.name) ||
      (typeof selectedProductConfig?.ProductType === "string" && selectedProductConfig.ProductType) ||
      (typeof selectedProductConfig?.productType === "string" && selectedProductConfig.productType) ||
      null;
    const cabinetGroup = mapCabinetTypeToGroup(cabinetType ?? configName ?? selectedSceneProduct ?? null, profile);
    const drawers = typeof selectedProductConfig?.Drawers === "string" ? selectedProductConfig.Drawers : null;
    const handleType = mapSidePanelDrawersToHandleType(drawers, profile);
    const height =
      typeof dimensions.height === "number"
        ? dimensions.height
        : typeof selectedProductConfig?.Height === "number"
          ? selectedProductConfig.Height
          : null;
    return sidePanelAvailabilityRule({ height, handleType, cabinetType: cabinetGroup }, profile);
  },
);
