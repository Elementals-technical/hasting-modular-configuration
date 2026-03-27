import type { RootState } from "@/app/store";

export const getIsSwatchSidebarOpen = (state: RootState) => state.rootStateUI.swatchSidebar.isOpen;
export const getSelectedSwatches = (state: RootState) => state.rootStateUI.swatchSidebar.selectedValues;
export const getIsSwatchesEnabledInSummary = (state: RootState) => state.rootStateUI.swatchSidebar.isEnabledInSummary;
