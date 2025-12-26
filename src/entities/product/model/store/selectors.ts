import type { RootState } from "@/app/store";

export const getActiveCabinetType = (state: RootState) => state.rootStateUI.product.activeCabinetType;

export const getDimensionOptions = (state: RootState) => state.rootStateUI.product.dimensionOptions;

export const getSelectedDimensions = (state: RootState) => state.rootStateUI.product.selectedDimensions;

export const getSelectedProducts = (state: RootState) => state.rootStateUI.product.productIds;

export const getDrawerProduct = (state: RootState) => state.rootStateUI.product.activeDrawerProduct;

export const getSelectedProductConfig = (state: RootState) => state.rootStateUI.product.selectedProductConfig;

export const getCabinetColor = (state: RootState) => state.rootStateUI.product.productOptions.CabinetColor;

export const getHandleGrooveColor = (state: RootState) => state.rootStateUI.product.productOptions.HandleGrooveColor;

export const getSinkType = (state: RootState) => state.rootStateUI.product.productOptions.sinkType;

export const getProductsPresets = (state: RootState) => state.rootStateUI.product.productsPresets;

export const getSelectedSceneProduct = (state: RootState) => state.rootStateUI.product.selectedSceneProduct;

export const getActiveCountertopColor = (state: RootState) => state.rootStateUI.product.productOptions.CountertopColor;

export const getActiveCountertopThickness = (state: RootState) => state.rootStateUI.product.productOptions.Thickness;

export const getDrawerPanelFluting = (state: RootState) =>
  state.rootStateUI.product.productOptions.DrawerPanelFluting;

export const getGrainDirection = (state: RootState) => state.rootStateUI.product.productOptions.GrainDirection;

export const getCountertopStyle = (state: RootState) => state.rootStateUI.product.productOptions.CountertopStyle;

export const getSidePanelsOption = (state: RootState) => state.rootStateUI.product.productOptions.SidePanels;

export const getLedOption = (state: RootState) => state.rootStateUI.product.productOptions.LedOption;

export const getDividersOption = (state: RootState) => state.rootStateUI.product.productOptions.DividersOption;

export const getTowelBarOption = (state: RootState) => state.rootStateUI.product.productOptions.TowelBarOption;

export const getFaucetHolesAmount = (state: RootState) =>
  state.rootStateUI.product.productOptions.FaucetHolesAmount;

export const getFaucetHolesSpacing = (state: RootState) =>
  state.rootStateUI.product.productOptions.FaucetHolesSpacing;
