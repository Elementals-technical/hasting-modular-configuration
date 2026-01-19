import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  applyConfiguratorRules,
  type Intent,
  type OptionState,
  type Selection,
} from "@/features/configurator-rule-core";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";
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
  activeCabinetType: string | null;
  activeDrawerProduct: string;
  selectedProductConfig: ProductConfig | null;
  selectedDimensions: ProductDimensions;
  heightBeforePto: number | null;
  hasBootstrappedCabinetBuilder: boolean;
  dimensionOptions: DimensionOptionGroup;
  cabinetCatalog: ConfiguratorCatalog;
  productOptions: {
    CabinetColor: string;
    sinkType: string;
    CountertopColor: string;
    HandleGrooveColor: string;
    Handle: HandleOption;
    Thickness: string;
    DrawerPanelFluting: string;
    GrainDirection: string;
    CountertopStyle: string;
    SidePanels: string;
    LedOption: string;
    DividersOption: string;
    DividersStyle: string;
    TowelBarOption: string;
    TowelBarColor: string;
    FaucetHolesAmount: string;
    FaucetHolesSpacing: string;
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
  cabinetType: state.activeCabinetType,
  width: state.selectedDimensions.width,
  depth: state.selectedDimensions.depth,
  height: state.selectedDimensions.height,
  drawers: mapDrawerConfigToRule(state.selectedProductConfig?.Drawers),
  handle: mapHandleConfigToRule(state.selectedProductConfig?.Handle),
});

const applyRulesToState = (state: ProductState, intent?: Intent) => {
  const ruleResult = applyConfiguratorRules(
    toSelection(state),
    intent,
    { selectedProductIds: state.productIds },
    state.cabinetCatalog,
  );

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
    heightBeforePto: null,

    hasBootstrappedCabinetBuilder: false,

    dimensionOptions: {
      width: [],
      height: [],
      depth: [],
      drawers: [],
      handles: [],
    },
    cabinetCatalog: { typeCabinetRules: [] },
    productOptions: {
      CabinetColor: "Ardesia DD GL",
      sinkType: "Top_HPLPrisma",
      CountertopColor: "Rosso Rubino 19 MT",
      HandleGrooveColor: "Blu Pavone A6 MT",
      Handle: "",
      Thickness: "",
      DrawerPanelFluting: "",
      GrainDirection: "",
      CountertopStyle: "",
      SidePanels: "",
      LedOption: "",
      DividersOption: "",
      DividersStyle: "",
      TowelBarOption: "None",
      TowelBarColor: "",
      FaucetHolesAmount: "",
      FaucetHolesSpacing: '4"',
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
    insertProductIdRelative(state, action: PayloadAction<{ id: string; prevId: string; side: "left" | "right" }>) {
      const { id, prevId, side } = action.payload;
      if (!id) return;

      const next = state.productIds.filter((pid) => pid !== id);
      const prevIndex = next.indexOf(prevId);

      if (prevIndex === -1) {
        next.push(id);
        state.productIds = next;
        return;
      }

      const insertIndex = side === "left" ? prevIndex : prevIndex + 1;
      next.splice(insertIndex, 0, id);
      state.productIds = next;
    },
    removeProductId(state, action: PayloadAction<string>) {
      const lastIndex = state.productIds.lastIndexOf(action.payload);

      if (lastIndex !== -1) {
        state.productIds.splice(lastIndex, 1);
      }
    },
    swapProductIds(state, action: PayloadAction<{ idA: string; idB: string }>) {
      const { idA, idB } = action.payload;
      const indexA = state.productIds.indexOf(idA);
      const indexB = state.productIds.indexOf(idB);

      if (indexA === -1 || indexB === -1 || indexA === indexB) return;

      const next = [...state.productIds];
      next[indexA] = idB;
      next[indexB] = idA;
      state.productIds = next;
    },
    reset(state) {
      return {
        ...createInitialState(),
        cabinetCatalog: state.cabinetCatalog,
      };
    },
    resetProducts(state) {
      state.productIds = [];
    },
    resetCabinetBuilderBootstrap(state) {
      state.hasBootstrappedCabinetBuilder = false;
    },
    resetPrebuiltProducts(state) {
      state.productsPresets = [];
    },
    setCabinetCatalog(state, action: PayloadAction<ConfiguratorCatalog>) {
      state.cabinetCatalog = action.payload;
      applyRulesToState(state);
    },
    addProductPreset(state, action: PayloadAction<PresetProduct[]>) {
      state.productsPresets = action.payload;
    },

    setDrawerProduct(state, action: PayloadAction<string>) {
      state.activeDrawerProduct = action.payload;
    },
    setActiveCabinetType(state, action: PayloadAction<string>) {
      const previousCabinetType = state.activeCabinetType;
      const newCabinetTypeId = action.payload;

      state.activeCabinetType = newCabinetTypeId;

      // When switching to a new cabinet type, set a default height if current height is invalid
      if (newCabinetTypeId !== previousCabinetType && newCabinetTypeId !== null) {
        const cabinetRule = state.cabinetCatalog.typeCabinetRules.find((rule) => rule.code === newCabinetTypeId);

        if (cabinetRule && cabinetRule.heights.length > 0) {
          const currentHeight = state.selectedDimensions.height;
          const isCurrentHeightValid = cabinetRule.heights.includes(currentHeight);

          // If current height is not valid for the new cabinet type, use the last available height
          // (typically the default/preferred height for that cabinet type)
          if (!isCurrentHeightValid) {
            const defaultHeight = cabinetRule.heights[cabinetRule.heights.length - 1];
            state.selectedDimensions.height = defaultHeight;
          }
        }
      }

      applyRulesToState(state, { field: "cabinetType", value: newCabinetTypeId });
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
      const prevHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle);

      // Preserve Handle from previous config if new config doesn't have one
      const preservedHandle = action.payload?.Handle ? action.payload.Handle : state.selectedProductConfig?.Handle;

      state.selectedProductConfig = action.payload
        ? {
            ...action.payload,
            ...(preservedHandle && !action.payload.Handle ? { Handle: preservedHandle } : {}),
          }
        : null;

      const nextHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle);

      if (prevHandle !== "handle_pto" && nextHandle === "handle_pto") {
        state.heightBeforePto = state.selectedDimensions.height;
      }

      if (prevHandle === "handle_pto" && nextHandle !== "handle_pto" && state.heightBeforePto !== null) {
        state.selectedDimensions.height = state.heightBeforePto;
      }

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
    setDrawerPanelFluting(state, action: PayloadAction<string>) {
      state.productOptions.DrawerPanelFluting = action.payload;
    },
    setGrainDirection(state, action: PayloadAction<string>) {
      state.productOptions.GrainDirection = action.payload;
    },
    setCountertopStyle(state, action: PayloadAction<string>) {
      state.productOptions.CountertopStyle = action.payload;
    },
    setSidePanelsOption(state, action: PayloadAction<string>) {
      state.productOptions.SidePanels = action.payload;
    },
    setLedOption(state, action: PayloadAction<string>) {
      state.productOptions.LedOption = action.payload;
    },
    setDividersOption(state, action: PayloadAction<string>) {
      state.productOptions.DividersOption = action.payload;
    },
    setDividersStyle(state, action: PayloadAction<string>) {
      state.productOptions.DividersStyle = action.payload;
    },
    setTowelBarOption(state, action: PayloadAction<string>) {
      state.productOptions.TowelBarOption = action.payload;
    },
    setTowelBarColor(state, action: PayloadAction<string>) {
      state.productOptions.TowelBarColor = action.payload;
    },
    setFaucetHolesAmount(state, action: PayloadAction<string>) {
      state.productOptions.FaucetHolesAmount = action.payload;
    },
    setFaucetHolesSpacing(state, action: PayloadAction<string>) {
      state.productOptions.FaucetHolesSpacing = action.payload;
    },

    setSelectedSceneProduct(state, action: PayloadAction<string>) {
      state.selectedSceneProduct = action.payload;
    },
    setHasBootstrappedCabinetBuilder(state, action: PayloadAction<boolean>) {
      state.hasBootstrappedCabinetBuilder = action.payload;
    },
  },
});

export const {
  addProductId,
  addProductPreset,
  removeProductId,
  swapProductIds,
  insertProductIdRelative,
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
  setDrawerPanelFluting,
  setGrainDirection,
  setCountertopStyle,
  setSidePanelsOption,
  setLedOption,
  setDividersOption,
  setDividersStyle,
  setTowelBarOption,
  setTowelBarColor,
  setFaucetHolesAmount,
  setFaucetHolesSpacing,
  resetPrebuiltProducts,
  setCabinetCatalog,
  setSelectedSceneProduct,
  resetCabinetBuilderBootstrap,
  setHasBootstrappedCabinetBuilder,
} = productSlice.actions;
export const productReducer = productSlice.reducer;
