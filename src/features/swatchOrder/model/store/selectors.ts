import type { RootState } from "@/app/store";

export const getIsSwatchOrderOpen = (state: RootState) => state.rootStateUI.swatchOrder.isOpen;
export const getActiveProductElement = (state: RootState) =>
  state.rootStateUI.swatchOrder.activeProductElement;
export const getAllMaterialValues = (state: RootState) =>
  state.rootStateUI.swatchOrder.allMaterialsValues;
export const getProductElementOptions = (state: RootState) =>
  state.rootStateUI.swatchOrder.productElementOptions;
export const getMaterialSelectStateFilters = (state: RootState) =>
  state.rootStateUI.swatchOrder.materialSelectState;
export const getSelectedMaterials = (state: RootState) =>
  state.rootStateUI.swatchOrder.selectedMaterials;
export const getIsSwatchesEnabledInSummary = (state: RootState) =>
  state.rootStateUI.swatchOrder.isEnabledInSummary;
export const getIsAutofillEnabled = (state: RootState) =>
  state.rootStateUI.swatchOrder.isAutofillEnabled;
export const getHasSubmittedCart = (state: RootState) =>
  state.rootStateUI.swatchOrder.hasSubmittedCart;
export const getIsSwatchesVisibleInSummary = (state: RootState) =>
  state.rootStateUI.swatchOrder.isAutofillEnabled ||
  state.rootStateUI.swatchOrder.hasSubmittedCart;
