import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import type { PresetProduct } from "../../types";

type DimensionOption = {
  name: number;
  value: number;
};

type ProductState = {
  productIds: string[];
  activeCabinetType: number | null;
  activeDrawerProduct: string;
  selectedProductConfig: ProductConfig | null;
  selectedDimensions: ProductDimensions;
  dimensionOptions: {
    width: DimensionOption[];
    height: DimensionOption[];
    depth: DimensionOption[];
  };
  productOptions: {
    CabinetColor: string;
    sinkType: string;
    CountertopColor: string;
    HandleGrooveColor: string;
  };

  productsPresets: PresetProduct[];
};

type ProductDimensions = {
  width: number;
  height: number;
  depth: number;
};

type ProductConfig = {
  [key: string]: unknown;
} & Partial<addProductConfigI>;

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

const DEFAULT_DIMENSIONS: ProductDimensions = {
  width: 60,
  height: 56,
  depth: 46,
};

const initialState: ProductState = {
  productIds: [],
  activeCabinetType: null,
  activeDrawerProduct: "",
  selectedProductConfig: null,
  selectedDimensions: DEFAULT_DIMENSIONS,
  dimensionOptions: {
    width: WIDTH_OPTIONS,
    height: HEIGHT_OPTIONS,
    depth: DEPTH_OPTIONS,
  },
  productOptions: {
    CabinetColor: "White Matte",
    sinkType: "",
    CountertopColor: "",
    HandleGrooveColor: "",
  },

  productsPresets: [],
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
    resetProducts(state) {
      state.productIds = [];
    },
    resetPrebuiltProducts(state) {
      state.productsPresets = [];
    },
    addProductPreset(state, action: PayloadAction<PresetProduct[]>) {
      state.productsPresets = action.payload;
    },

    setDrawerProduct(state, action: PayloadAction<string>) {
      state.activeDrawerProduct = action.payload;
    },
    setActiveCabinetType(state, action: PayloadAction<number>) {
      state.activeCabinetType = action.payload;
    },
    setSelectedDimensions(state, action: PayloadAction<Partial<ProductDimensions>>) {
      state.selectedDimensions = { ...state.selectedDimensions, ...action.payload };
    },
    setSelectedProductConfig(state, action: PayloadAction<ProductConfig | null>) {
      state.selectedProductConfig = action.payload;
    },
    setCabinetColor(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColor = action.payload;
    },
    setHandleGrooveColor(state, action: PayloadAction<string>) {
      state.productOptions.HandleGrooveColor = action.payload;
    },
    setActiveBasinStyle(state, action: PayloadAction<string>) {
      state.productOptions.sinkType = action.payload;
    },
    setActiveCountertopColor(state, action: PayloadAction<string>) {
      state.productOptions.CountertopColor = action.payload;
    },
  },
});

export const {
  addProductId,
  addProductPreset,
  removeProductId,
  reset,
  setActiveCabinetType,
  setSelectedDimensions,
  setDrawerProduct,
  setSelectedProductConfig,
  setCabinetColor,
  setHandleGrooveColor,
  resetProducts,
  setActiveBasinStyle,
  setActiveCountertopColor,
  resetPrebuiltProducts,
} = productSlice.actions;
export const productReducer = productSlice.reducer;
