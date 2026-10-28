import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SidebarState = {
  isOpen: boolean;
  activeStep: string | null;
  isOpenStyleSidebar: boolean;
  /**
   * The style sidebar shows the scene's "+" buttons for the cabinet being added and a width fits the
   * countertop's own row: the player offers Drag to Place beside them.
   */
  placementButtonsVisible: boolean;
};

const initialState: SidebarState = {
  isOpen: false,
  activeStep: null,
  isOpenStyleSidebar: false,
  placementButtonsVisible: false,
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    open(state) {
      state.isOpen = true;
      state.isOpenStyleSidebar = false;
    },
    close(state) {
      state.isOpen = false;
    },
    toggle(state) {
      state.isOpen = !state.isOpen;
      if (state.isOpen) {
        state.isOpenStyleSidebar = false;
      }
    },
    setActiveStep(state, action: PayloadAction<string | null>) {
      state.activeStep = action.payload;
    },
    reset() {
      return initialState;
    },
    setOpenStyleSidebar(state, action: PayloadAction<boolean>) {
      state.isOpenStyleSidebar = action.payload;
      if (action.payload) {
        state.isOpen = false;
      }
    },
    setPlacementButtonsVisible(state, action: PayloadAction<boolean>) {
      state.placementButtonsVisible = action.payload;
    },
  },
});

export const { open, close, toggle, setActiveStep, reset, setOpenStyleSidebar, setPlacementButtonsVisible } =
  sidebarSlice.actions;
export const sidebarReducer = sidebarSlice.reducer;
