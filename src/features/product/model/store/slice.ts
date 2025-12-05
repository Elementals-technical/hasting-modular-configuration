import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type ProductState = {
  productIds: string[];
};

const initialState: ProductState = {
  productIds: [],
};

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    addProductId(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!id) return;
      const next = [...state.productIds.filter((pid) => pid !== id), id].slice(-3);
      state.productIds = next;
    },
    removeProductId(state, action: PayloadAction<string>) {
      state.productIds = state.productIds.filter((pid) => pid !== action.payload);
    },
    reset() {
      return initialState;
    },
  },
});

export const { addProductId, removeProductId, reset } = productSlice.actions;
export const productReducer = productSlice.reducer;
