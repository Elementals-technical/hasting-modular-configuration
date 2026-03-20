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
  getSelectedSceneProduct,
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

const mapCabinetTypeToGroup = (cabinetType?: string | null) => {
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
    console.log("[SidePanels] availability inputs", {
      cabinetType,
      configName,
      selectedSceneProduct,
      cabinetGroup,
      drawers,
      handleType,
      height,
    });
    const result = sidePanelAvailabilityRule({ height, handleType, cabinetType: cabinetGroup });
    console.log("[SidePanels] availability result", Array.from(result.allowed.values()));
    return result;
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
