import type { RootState } from "@/app/store";

export const getActiveCabinetType = (state: RootState) => state.rootStateUI.product.activeCabinetType;
export const getDimensionOptions = (state: RootState) => state.rootStateUI.product.dimensionOptions;
