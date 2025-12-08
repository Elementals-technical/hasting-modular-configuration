import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type ProductState = {
  productIds: string[];
  activeCabinetType: number | null;
};

const initialState: ProductState = {
  productIds: [],
  activeCabinetType: null,
};

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    addProductId(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!id) return;
      const next = [...state.productIds.filter((pid) => pid !== id), id];
      state.productIds = next;
    },
    removeProductId(state, action: PayloadAction<string>) {
      state.productIds = state.productIds.filter((pid) => pid !== action.payload);
    },
    reset() {
      return initialState;
    },
    setActiveCabinetType(state, action: PayloadAction<number>) {
      state.activeCabinetType = action.payload;
    },
  },
});

export const { addProductId, removeProductId, reset, setActiveCabinetType } = productSlice.actions;
export const productReducer = productSlice.reducer;
