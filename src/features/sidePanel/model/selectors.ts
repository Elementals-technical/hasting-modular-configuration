import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import { sidePanelAvailabilityRule } from "../lib/sidePanelRules";

// ── Plain selectors ────────────────────────────────────────────────────

export const getSidePanelsOption = (state: RootState) => state.rootStateUI.product.productOptions.SidePanels;
export const getSidePanelLeftStatus = (state: RootState) => state.rootStateUI.product.productOptions.SidePanelLeft;
export const getSidePanelRightStatus = (state: RootState) => state.rootStateUI.product.productOptions.SidePanelRight;

// ── Helpers ────────────────────────────────────────────────────────────

export const mapCabinetTypeToGroup = (cabinetType?: string | null) => {
  if (!cabinetType) return null;

  const val = cabinetType.toLowerCase();

  if (val.includes("side-shelf") || val === "oss") return "OSS";
  if (val.includes("open-shelf") || val === "os") return "OS";
  if (
    val.includes("sink-base") ||
    val.includes("sink-cabinet") ||
    val.includes("side-cabinet") ||
    val === "sb" ||
    val === "sc" ||
    val === "sbsc"
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

// ── Derived selectors ──────────────────────────────────────────────────

const getActiveCabinetType = (state: RootState) => state.rootStateUI.product.activeCabinetType;
const getSelectedProductConfig = (state: RootState) => state.rootStateUI.product.selectedProductConfig;
const getSelectedDimensions = (state: RootState) => state.rootStateUI.product.selectedDimensions;
const getSelectedSceneProduct = (state: RootState) => state.rootStateUI.product.selectedSceneProduct;

export const selectSidePanelAvailability = createSelector(
  [getActiveCabinetType, getSelectedProductConfig, getSelectedDimensions, getSelectedSceneProduct],
  (cabinetType, selectedProductConfig, dimensions, selectedSceneProduct) => {
    const configName =
      (typeof selectedProductConfig?.name === "string" && selectedProductConfig.name) ||
      (typeof selectedProductConfig?.ProductType === "string" && selectedProductConfig.ProductType) ||
      (typeof selectedProductConfig?.productType === "string" && selectedProductConfig.productType) ||
      null;
    const cabinetGroup = mapCabinetTypeToGroup(cabinetType ?? configName ?? selectedSceneProduct ?? null);
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
