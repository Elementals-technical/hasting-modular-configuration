import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SidebarState = {
  isOpen: boolean;
  activeStep: string | null;
};

const initialState: SidebarState = {
  isOpen: false,
  activeStep: null,
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    open(state) {
      state.isOpen = true;
    },
    close(state) {
      state.isOpen = false;
    },
    toggle(state) {
      state.isOpen = !state.isOpen;
    },
    setActiveStep(state, action: PayloadAction<string | null>) {
      state.activeStep = action.payload;
    },
    reset() {
      return initialState;
    },
  },
});

export const { open, close, toggle, setActiveStep, reset } = sidebarSlice.actions;
export const sidebarReducer = sidebarSlice.reducer;
