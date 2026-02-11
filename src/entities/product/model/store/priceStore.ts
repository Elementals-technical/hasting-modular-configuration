import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type PriceState = {
  skuPrices: Record<string, number>;
  activeSkus: string[];
  total: number;
};

const calculateTotal = (prices: Record<string, number>, activeSkus: string[]) =>
  activeSkus.reduce((sum, sku) => sum + (prices[sku] ?? 0), 0);

const initialState: PriceState = {
  skuPrices: {},
  activeSkus: [],
  total: 0,
};

const priceStoreSlice = createSlice({
  name: "PriceStore",
  initialState,
  reducers: {
    setActiveSkus(state, action: PayloadAction<string[]>) {
      state.activeSkus = action.payload;
      state.total = calculateTotal(state.skuPrices, state.activeSkus);
    },
    setSkuPrices(state, action: PayloadAction<Record<string, number>>) {
      state.skuPrices = { ...state.skuPrices, ...action.payload };
      state.total = calculateTotal(state.skuPrices, state.activeSkus);
    },
    resetPrices() {
      return initialState;
    },
  },
});

export const { setActiveSkus, setSkuPrices, resetPrices } = priceStoreSlice.actions;
export const priceStoreReducer = priceStoreSlice.reducer;
