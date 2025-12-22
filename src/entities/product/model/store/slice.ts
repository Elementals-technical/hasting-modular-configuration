import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  applyConfiguratorRules,
  type Intent,
  type OptionState,
  type Selection,
} from "@/features/configurator-rule-core";
import type { addProductConfigI } from "@/utils/functions/playcanvas/addProduct";
import type { PresetProduct } from "../../types";

type DimensionOption = {
  name: number | string;
  value: number | string;
  disabled?: boolean;
  reason?: string;
};

type DimensionOptionGroup = {
  width: DimensionOption[];
  height: DimensionOption[];
  depth: DimensionOption[];
  drawers: DimensionOption[];
  handles: DimensionOption[];
};

type ProductState = {
  productIds: string[];
  activeCabinetType: number | null;
  activeDrawerProduct: string;
  selectedProductConfig: ProductConfig | null;
  selectedDimensions: ProductDimensions;
  dimensionOptions: DimensionOptionGroup;
  productOptions: {
    CabinetColor: string;
    sinkType: string;
    CountertopColor: string;
    HandleGrooveColor: string;
    Handle: HandleOption;
    Thickness: string;
  };

  productsPresets: PresetProduct[];
  selectedSceneProduct: string;
};

type ProductDimensions = {
  width: number;
  height: number;
  depth: number;
};

type ProductConfig = {
  [key: string]: unknown;
} & Partial<addProductConfigI>;

type HandleOption = "" | "handle_pto" | "handle_urban_topcut" | "handle_urban_botcut";

const DEFAULT_DIMENSIONS: ProductDimensions = {
  width: 60,
  height: 56,
  depth: 46,
};

const mapOptionState = <T extends string | number>(option: OptionState<T>): DimensionOption => ({
  name: option.label ?? option.value,
  value: option.value,
  disabled: !option.enabled,
  reason: option.reason,
});

const mapDrawerConfigToRule = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  if (normalized === "1D") return "1";
  if (normalized === "2D") return "2";
  if (normalized === "1DWID") return "1+inner";

  if (normalized === "1" || normalized === "2" || normalized === "1+inner") {
    return normalized;
  }

  return null;
};

const mapHandleConfigToRule = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toSelection = (state: ProductState): Selection => ({
  cabinetTypeId: state.activeCabinetType,
  width: state.selectedDimensions.width,
  depth: state.selectedDimensions.depth,
  height: state.selectedDimensions.height,
  drawers: mapDrawerConfigToRule(state.selectedProductConfig?.Drawers),
  handle: mapHandleConfigToRule(state.selectedProductConfig?.Handle),
});

const applyRulesToState = (state: ProductState, intent?: Intent) => {
  const ruleResult = applyConfiguratorRules(toSelection(state), intent);

  state.dimensionOptions = {
    width: ruleResult.availableOptions.width.map(mapOptionState),
    depth: ruleResult.availableOptions.depth.map(mapOptionState),
    height: ruleResult.availableOptions.height.map(mapOptionState),
    drawers: ruleResult.availableOptions.drawers.map(mapOptionState),
    handles: ruleResult.availableOptions.handles.map(mapOptionState),
  };

  state.selectedDimensions = {
    width: ruleResult.nextSelection.width,
    height: ruleResult.nextSelection.height,
    depth: ruleResult.nextSelection.depth,
  };
};

const createInitialState = (): ProductState => {
  const baseState: ProductState = {
    productIds: [],
    activeCabinetType: null,
    activeDrawerProduct: "",
    selectedProductConfig: null,
    selectedDimensions: DEFAULT_DIMENSIONS,
    dimensionOptions: {
      width: [],
      height: [],
      depth: [],
      drawers: [],
      handles: [],
    },
    productOptions: {
      CabinetColor: "White Matte",
      sinkType: "",
      CountertopColor: "",
      HandleGrooveColor: "",
      Handle: "",
      Thickness: "",
    },

    productsPresets: [],
    selectedSceneProduct: "",
  };

  applyRulesToState(baseState);

  return baseState;
};

const initialState: ProductState = createInitialState();

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
      return createInitialState();
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
      applyRulesToState(state, { field: "cabinetTypeId", value: action.payload });
    },
    setSelectedDimensions(state, action: PayloadAction<Partial<ProductDimensions>>) {
      state.selectedDimensions = { ...state.selectedDimensions, ...action.payload };
      const [intentField, intentValue] = Object.entries(action.payload)[0] ?? [];

      if (intentField) {
        const intent: Intent = { field: intentField as Intent["field"], value: intentValue as number };

        applyRulesToState(state, intent);
      } else {
        applyRulesToState(state);
      }
    },
    setSelectedProductConfig(state, action: PayloadAction<ProductConfig | null>) {
      state.selectedProductConfig = action.payload;
      applyRulesToState(state);
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
    setActiveCountertopThickness(state, action: PayloadAction<string>) {
      state.productOptions.Thickness = action.payload;
    },

    setSelectedSceneProduct(state, action: PayloadAction<string>) {
      state.selectedSceneProduct = action.payload;
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
  setActiveCountertopThickness,
  resetPrebuiltProducts,
  setSelectedSceneProduct,
} = productSlice.actions;
export const productReducer = productSlice.reducer;
