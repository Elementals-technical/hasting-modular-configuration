import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { MAX_SWATCHES } from "../constants";

type SwatchSidebarState = {
  isOpen: boolean;
  selectedValues: string[];
  isEnabledInSummary: boolean;
};

const initialState: SwatchSidebarState = {
  isOpen: false,
  selectedValues: [],
  isEnabledInSummary: true,
};

const swatchSidebarSlice = createSlice({
  name: "swatchSidebar",
  initialState,
  reducers: {
    openSwatchSidebar(state) {
      state.isOpen = true;
    },
    closeSwatchSidebar(state) {
      state.isOpen = false;
    },
    toggleSwatchSidebar(state) {
      state.isOpen = !state.isOpen;
    },
    toggleSwatchSelection(state, action: PayloadAction<string>) {
      const value = action.payload;
      const existingIndex = state.selectedValues.indexOf(value);

      if (existingIndex >= 0) {
        state.selectedValues.splice(existingIndex, 1);
        return;
      }

      if (state.selectedValues.length >= MAX_SWATCHES) return;
      state.selectedValues.push(value);
    },
    setSelectedSwatches(state, action: PayloadAction<string[]>) {
      state.selectedValues = Array.from(new Set(action.payload)).slice(0, MAX_SWATCHES);
    },
    clearSelectedSwatches(state) {
      state.selectedValues = [];
    },
    setSwatchesEnabledInSummary(state, action: PayloadAction<boolean>) {
      state.isEnabledInSummary = action.payload;
    },
  },
});

export const {
  openSwatchSidebar,
  closeSwatchSidebar,
  toggleSwatchSidebar,
  toggleSwatchSelection,
  setSelectedSwatches,
  clearSelectedSwatches,
  setSwatchesEnabledInSummary,
} = swatchSidebarSlice.actions;

export const swatchSidebarReducer = swatchSidebarSlice.reducer;
