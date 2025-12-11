import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type DimensionOption = {
  name: number;
  value: number;
};

type ProductState = {
  productIds: string[];
  activeCabinetType: number | null;
  dimensionOptions: {
    width: DimensionOption[];
    height: DimensionOption[];
    depth: DimensionOption[];
  };
};

const WIDTH_OPTIONS: DimensionOption[] = [
  { name: 25, value: 25 },
  { name: 35, value: 35 },
  { name: 50, value: 50 },
  { name: 60, value: 60 },
  { name: 70, value: 70 },
  { name: 90, value: 90 },
  { name: 105, value: 105 },
  { name: 120, value: 120 },
];

const HEIGHT_OPTIONS: DimensionOption[] = [
  { name: 50, value: 50 },
  { name: 53, value: 53 },
  { name: 56, value: 56 },
];

const DEPTH_OPTIONS: DimensionOption[] = [
  { name: 46, value: 46 },
  { name: 50.5, value: 50.5 },
];

const initialState: ProductState = {
  productIds: [],
  activeCabinetType: null,
  dimensionOptions: {
    width: WIDTH_OPTIONS,
    height: HEIGHT_OPTIONS,
    depth: DEPTH_OPTIONS,
  },
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
      const lastIndex = state.productIds.lastIndexOf(action.payload);

      if (lastIndex !== -1) {
        state.productIds.splice(lastIndex, 1);
      }
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
