import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type ProductState = {
  productId: string | null;
};

const initialState: ProductState = {
  productId: null,
};

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    setProductId(state, action: PayloadAction<string | null>) {
      state.productId = action.payload;
    },
    reset() {
      return initialState;
    },
  },
});

export const { setProductId, reset } = productSlice.actions;
export const productReducer = productSlice.reducer;
