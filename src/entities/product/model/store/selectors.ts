import type { RootState } from "@/app/store";

export const getActiveCabinetType = (state: RootState) => state.rootStateUI.product.activeCabinetType;

export const getCabinetCatalog = (state: RootState) => state.rootStateUI.product.cabinetCatalog;

export const getActiveCabinetRule = (state: RootState) => {
  const activeCode = state.rootStateUI.product.activeCabinetType;
  if (!activeCode) return null;

  return state.rootStateUI.product.cabinetCatalog.typeCabinetRules.find((rule) => rule.code === activeCode) ?? null;
};

export const getDimensionOptions = (state: RootState) => state.rootStateUI.product.dimensionOptions;

export const getSelectedDimensions = (state: RootState) => state.rootStateUI.product.selectedDimensions;

export const getHasBootstrappedCabinetBuilder = (state: RootState) =>
  state.rootStateUI.product.hasBootstrappedCabinetBuilder;

export const getSelectedProducts = (state: RootState) => state.rootStateUI.product.productIds;

export const getDrawerProduct = (state: RootState) => state.rootStateUI.product.activeDrawerProduct;

export const getSelectedProductConfig = (state: RootState) => state.rootStateUI.product.selectedProductConfig;

export const getCabinetColor = (state: RootState) => state.rootStateUI.product.productOptions.CabinetColor;

export const getHandleGrooveColor = (state: RootState) => state.rootStateUI.product.productOptions.HandleGrooveColor;

export const getSinkType = (state: RootState) => state.rootStateUI.product.productOptions.sinkType;

export const getProductsPresets = (state: RootState) => state.rootStateUI.product.productsPresets;

export const getSelectedSceneProduct = (state: RootState) => state.rootStateUI.product.selectedSceneProduct;

export const getIsDrawerOpen = (state: RootState) => state.rootStateUI.product.isDrawerOpen;

export const getActiveCountertopColor = (state: RootState) => state.rootStateUI.product.productOptions.CountertopColor;

export const getActiveCountertopThickness = (state: RootState) => state.rootStateUI.product.productOptions.Thickness;

export const getDrawerPanelFluting = (state: RootState) => state.rootStateUI.product.productOptions.DrawerPanelFluting;

export const getGrainDirection = (state: RootState) => state.rootStateUI.product.productOptions.GrainDirection;

export const getCountertopStyle = (state: RootState) => state.rootStateUI.product.productOptions.CountertopStyle;

export const getSidePanelsOption = (state: RootState) => state.rootStateUI.product.productOptions.SidePanels;

export const getLedOption = (state: RootState) => state.rootStateUI.product.productOptions.LedOption;

export const getDividersOption = (state: RootState) => state.rootStateUI.product.productOptions.DividersOption;

export const getDividersStyle = (state: RootState) => state.rootStateUI.product.productOptions.DividersStyle;

export const getTowelBarOption = (state: RootState) => state.rootStateUI.product.productOptions.TowelBarOption;

export const getTowelBarColor = (state: RootState) => state.rootStateUI.product.productOptions.TowelBarColor;

export const getFaucetHolesAmount = (state: RootState) => state.rootStateUI.product.productOptions.FaucetHolesAmount;

export const getFaucetHolesSpacing = (state: RootState) => state.rootStateUI.product.productOptions.FaucetHolesSpacing;

// For attention popup in the prebuilt path.
export const getHasPrebuiltSelections = (state: RootState) => {
  const options = state.rootStateUI.product.productOptions;

  return (
    options.CabinetColor !== "Ardesia DD GL" ||
    options.sinkType !== "Top_HPLPrisma" ||
    options.CountertopColor !== "Rosso Rubino 19 MT" ||
    options.HandleGrooveColor !== "Blu Pavone A6 MT" ||
    options.Handle !== "" ||
    options.Thickness !== "" ||
    options.DrawerPanelFluting !== "" ||
    options.GrainDirection !== "" ||
    options.CountertopStyle !== "" ||
    options.SidePanels !== "" ||
    options.LedOption !== "" ||
    options.DividersOption !== "" ||
    options.DividersStyle !== "" ||
    options.TowelBarOption !== "None" ||
    options.TowelBarColor !== "" ||
    options.FaucetHolesAmount !== "" ||
    options.FaucetHolesSpacing !== '4"'
  );
};
