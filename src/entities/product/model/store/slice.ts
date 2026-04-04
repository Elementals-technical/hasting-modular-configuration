import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  applyConfiguratorRules,
  type Intent,
  type OptionState,
  type Selection,
} from "@/features/configurator-rule-core/cabinetBuilder";
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

export type PlacedDivider = {
  key: string;
  cabinetId: string;
  drawerType: "Top" | "TopFull" | "Bot";
  zone: string;
  type: "A" | "B" | "C";
};

type ProductState = {
  productIds: string[];
  activeCabinetType: string | null;
  activeDrawerProduct: string;
  selectedProductConfig: ProductConfig | null;
  selectedDimensions: ProductDimensions;
  heightBeforePto: number | null;
  heightLocked: number | null;
  hasBootstrappedCabinetBuilder: boolean;
  dimensionOptions: DimensionOptionGroup;
  cabinetCatalog: ConfiguratorCatalog;
  placedDividers: PlacedDivider[];
  /** Maps productId → raw drawer value ("1", "2", "1+inner"). Only set for non-open cabinets. */
  placedCabinetStyles: Record<string, string>;
  productOptions: {
    CabinetColor: string;
    CabinetColorSku: string;
    CabinetColorMaterial: string;
    CabinetColorFinish: string;
    sinkType: string;
    CountertopColor: string;
    CountertopColorSku: string;
    VesselColor: string;
    HandleGrooveColor: string;
    HandleGrooveColorSku: string;
    Handle: HandleOption;
    Thickness: string;
    DrawerPanelFluting: string;
    GrainDirection: string;
    BookMatching: string;
    CountertopStyle: string;
    SidePanels: string;
    SidePanelLeft: "active" | "none" | "auto-removed";
    SidePanelRight: "active" | "none" | "auto-removed";
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
  isDrawerOpen: boolean;
};

type ProductDimensions = {
  width: number | null;
  height: number | null;
  depth: number | null;
};

type ProductConfig = {
  [key: string]: unknown;
} & Partial<addProductConfigI>;

export type HandleOption = "" | "handle_pto" | "handle_urban_topcut" | "handle_urban_botcut";

const DEFAULT_DIMENSIONS: ProductDimensions = {
  width: null,
  height: null,
  depth: null,
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
  width: state.selectedDimensions.width ?? 0,
  depth: state.selectedDimensions.depth ?? 0,
  height: state.selectedDimensions.height ?? 0,
  drawers: mapDrawerConfigToRule(state.selectedProductConfig?.Drawers),
  handle: mapHandleConfigToRule(state.selectedProductConfig?.Handle),
});

const applyRulesToState = (state: ProductState, intent?: Intent) => {
  if (!state.activeCabinetType) {
    state.dimensionOptions = {
      width: [],
      depth: [],
      height: [],
      drawers: [],
      handles: [],
    };
    state.heightLocked = null;
    return;
  }

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
  state.heightLocked = ruleResult.heightLocked;

  const currentHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle);
  if (currentHandle && ruleResult.availableOptions.handles.length > 0) {
    const handleOption = ruleResult.availableOptions.handles.find((h) => h.value === currentHandle);
    if (handleOption && !handleOption.enabled) {
      const preferred =
        typeof ruleResult.heightLocked === "number"
          ? ruleResult.availableOptions.handles.find((h) => h.value === "handle_pto" && h.enabled)
          : undefined;
      const firstEnabled = preferred ?? ruleResult.availableOptions.handles.find((h) => h.enabled);
      if (state.selectedProductConfig) {
        state.selectedProductConfig = {
          ...state.selectedProductConfig,
          Handle: firstEnabled ? (String(firstEnabled.value) as HandleOption) : undefined,
        };
      }
    }
  }

  if (!currentHandle && typeof ruleResult.heightLocked === "number") {
    const preferred = ruleResult.availableOptions.handles.find((h) => h.value === "handle_pto" && h.enabled);
    if (preferred && state.selectedProductConfig) {
      state.selectedProductConfig = {
        ...state.selectedProductConfig,
        Handle: "handle_pto",
      };
    }
  }

  if (
    typeof ruleResult.heightLocked === "number" &&
    ruleResult.heightLocked === 50 &&
    state.selectedProductConfig &&
    mapHandleConfigToRule(state.selectedProductConfig.Handle) !== "handle_pto"
  ) {
    const preferred = ruleResult.availableOptions.handles.find((h) => h.value === "handle_pto" && h.enabled);
    if (preferred) {
      if (mapHandleConfigToRule(state.selectedProductConfig.Handle) !== "handle_pto") {
        state.heightBeforePto = state.selectedDimensions.height;
      }
      state.selectedProductConfig = {
        ...state.selectedProductConfig,
        Handle: "handle_pto",
      };
    }
  }
};

const createInitialState = (): ProductState => {
  const baseState: ProductState = {
    productIds: [],
    activeCabinetType: null,
    activeDrawerProduct: "",
    selectedProductConfig: null,
    selectedDimensions: DEFAULT_DIMENSIONS,
    heightBeforePto: null,
    heightLocked: null,

    hasBootstrappedCabinetBuilder: false,

    dimensionOptions: {
      width: [],
      height: [],
      depth: [],
      drawers: [],
      handles: [],
    },
    cabinetCatalog: { typeCabinetRules: [] },
    placedDividers: [],
    placedCabinetStyles: {},
    productOptions: {
      CabinetColor: "Ardesia DD GL",
      CabinetColorSku: "",
      CabinetColorMaterial: "",
      CabinetColorFinish: "",
      sinkType: "Top_Tekorlux_Rectangular",
      CountertopColor: "Cacao Orinoco FF MT",
      CountertopColorSku: "",
      VesselColor: "",
      HandleGrooveColor: "",
      HandleGrooveColorSku: "",
      Handle: "",
      Thickness: "",
      DrawerPanelFluting: "",
      GrainDirection: "",
      BookMatching: "",
      CountertopStyle: "integrated",
      SidePanels: "",
      SidePanelLeft: "none" as const,
      SidePanelRight: "none" as const,
      LedOption: "",
      DividersOption: "",
      DividersStyle: "",
      TowelBarOption: "None",
      TowelBarColor: "",
      FaucetHolesAmount: "0",
      FaucetHolesSpacing: '4"',
    },

    productsPresets: [],
    selectedSceneProduct: "",
    isDrawerOpen: false,
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
      applyRulesToState(state);
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
      applyRulesToState(state);
    },
    removeProductId(state, action: PayloadAction<string>) {
      const lastIndex = state.productIds.lastIndexOf(action.payload);

      if (lastIndex !== -1) {
        state.productIds.splice(lastIndex, 1);
      }

      delete state.placedCabinetStyles[action.payload];
      applyRulesToState(state);
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
      applyRulesToState(state);
    },
    reset(state) {
      return {
        ...createInitialState(),
        cabinetCatalog: state.cabinetCatalog,
      };
    },
    resetProducts(state) {
      state.productIds = [];
      state.placedCabinetStyles = {};
      applyRulesToState(state);
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

    setPlacedCabinetStyle(state, action: PayloadAction<{ id: string; value: string }>) {
      state.placedCabinetStyles[action.payload.id] = action.payload.value;
    },
    updateAllPlacedCabinetStyles(state, action: PayloadAction<string>) {
      Object.keys(state.placedCabinetStyles).forEach((id) => {
        state.placedCabinetStyles[id] = action.payload;
      });
    },
    /** Atomically switches drawer style for all placed cabinets + updates selectedProductConfig in one reducer call,
     *  ensuring dominantDrawerGroup and dimensionOptions are both correct in the same render cycle.
     *  forcedHeight: the height already sent to PlayCanvas by the caller — used to override the
     *  rule engine result when supportsHeightForAllProducts would otherwise block the height change. */
    switchAllCabinetsDrawerStyle(
      state,
      action: PayloadAction<{ configValue: string; rawValue: string; forcedHeight?: number | null; forcedHandle?: string | null }>,
    ) {
      const { configValue, rawValue, forcedHeight, forcedHandle } = action.payload;

      if (state.selectedProductConfig) {
        state.selectedProductConfig = { ...state.selectedProductConfig, Drawers: configValue };
      } else {
        state.selectedProductConfig = { Drawers: configValue };
      }

      Object.keys(state.placedCabinetStyles).forEach((id) => {
        state.placedCabinetStyles[id] = rawValue;
      });

      applyRulesToState(state);

      // Override with values already applied to PlayCanvas so Redux stays in sync
      if (typeof forcedHeight === "number") {
        state.selectedDimensions.height = forcedHeight;
      }
      if (forcedHandle && state.selectedProductConfig) {
        state.selectedProductConfig = { ...state.selectedProductConfig, Handle: forcedHandle as HandleOption };
      }
    },
    setDrawerProduct(state, action: PayloadAction<string>) {
      state.activeDrawerProduct = action.payload;
    },
    setActiveCabinetType(state, action: PayloadAction<string | null>) {
      const previousCabinetType = state.activeCabinetType;
      const newCabinetTypeId = action.payload;

      state.activeCabinetType = newCabinetTypeId;

      // When switching to a new cabinet type, set a default height if current height is invalid
      if (newCabinetTypeId !== previousCabinetType && newCabinetTypeId !== null) {
        const cabinetRule = state.cabinetCatalog.typeCabinetRules.find((rule) => rule.code === newCabinetTypeId);

        if (cabinetRule && cabinetRule.heights.length > 0) {
          const currentHeight = state.selectedDimensions.height;
          const isCurrentHeightValid = typeof currentHeight === "number" && cabinetRule.heights.includes(currentHeight);

          // If current height is not valid for the new cabinet type, use the last available height
          // (typically the default/preferred height for that cabinet type)
          if (!isCurrentHeightValid) {
            // const currentHandle = mapHandleConfigToRule(state.selectedProductConfig?.Handle);
            // const hasForcedHandle = currentHandle === "handle_pto" || currentHandle === "handle_urban_topcut" || currentHandle === "handle_urban_botcut";

            // if (!hasForcedHandle) {
            const defaultHeight = cabinetRule.heights[cabinetRule.heights.length - 1];
            state.selectedDimensions.height = defaultHeight;
            // }
          }
        }
      }

      applyRulesToState(state, { field: "cabinetType", value: newCabinetTypeId });
    },
    setSelectedDimensions(state, action: PayloadAction<Partial<ProductDimensions>>) {
      state.selectedDimensions = { ...state.selectedDimensions, ...action.payload };
      const [intentField, intentValue] = Object.entries(action.payload)[0] ?? [];

      if (intentField) {
        const intent: Intent = { field: intentField as Intent["field"], value: intentValue as Intent["value"] };

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
        : preservedHandle
          ? { Handle: preservedHandle }
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
    setCabinetColorSku(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColorSku = action.payload;
    },
    setCabinetColorMaterial(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColorMaterial = action.payload;
    },
    setCabinetColorFinish(state, action: PayloadAction<string>) {
      state.productOptions.CabinetColorFinish = action.payload;
    },
    setHandleGrooveColor(state, action: PayloadAction<string>) {
      state.productOptions.HandleGrooveColor = action.payload;
    },
    setHandleGrooveColorSku(state, action: PayloadAction<string>) {
      state.productOptions.HandleGrooveColorSku = action.payload;
    },
    setActiveBasinStyle(state, action: PayloadAction<string>) {
      state.productOptions.sinkType = action.payload;
    },
    setActiveCountertopColor(state, action: PayloadAction<string>) {
      state.productOptions.CountertopColor = action.payload;
    },
    setCountertopColorSku(state, action: PayloadAction<string>) {
      state.productOptions.CountertopColorSku = action.payload;
    },
    setVesselColor(state, action: PayloadAction<string>) {
      state.productOptions.VesselColor = action.payload;
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
    setBookMatching(state, action: PayloadAction<string>) {
      state.productOptions.BookMatching = action.payload;
    },
    setCountertopStyle(state, action: PayloadAction<string>) {
      state.productOptions.CountertopStyle = action.payload;
    },
    setSidePanelsOption(state, action: PayloadAction<string>) {
      const prev = state.productOptions.SidePanels;
      console.warn("[SP] Redux groove", prev, "→", action.payload);
      state.productOptions.SidePanels = action.payload;
    },
    setSidePanelSideStatus(
      state,
      action: PayloadAction<{ side: "left" | "right"; status: "active" | "none" | "auto-removed" }>,
    ) {
      const { side, status } = action.payload;
      const key = side === "left" ? "SidePanelLeft" : "SidePanelRight";
      console.warn("[SP] Redux side", side, state.productOptions[key], "→", status);
      state.productOptions[key] = status;
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
    addPlacedDivider(state, action: PayloadAction<PlacedDivider>) {
      const idx = state.placedDividers.findIndex((d) => d.key === action.payload.key);
      if (idx >= 0) {
        state.placedDividers[idx] = action.payload;
      } else {
        state.placedDividers.push(action.payload);
      }
    },
    removePlacedDivider(state, action: PayloadAction<string>) {
      state.placedDividers = state.placedDividers.filter((d) => d.key !== action.payload);
    },
    clearPlacedDividers(state) {
      state.placedDividers = [];
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
    setIsDrawerOpen(state, action: PayloadAction<boolean>) {
      state.isDrawerOpen = action.payload;
    },
    setHasBootstrappedCabinetBuilder(state, action: PayloadAction<boolean>) {
      state.hasBootstrappedCabinetBuilder = action.payload;
    },
    restoreProductState(
      state,
      action: PayloadAction<{
        productIds: string[];
        productOptions: ProductState["productOptions"];
        activeCabinetType: string | null;
        selectedDimensions: { width: number | null; height: number | null; depth: number | null };
        placedDividers?: PlacedDivider[];
        selectedProductConfig?: ProductConfig | null;
        placedCabinetStyles?: Record<string, string>;
      }>,
    ) {
      const {
        productIds,
        productOptions,
        activeCabinetType,
        selectedDimensions,
        placedDividers,
        selectedProductConfig,
        placedCabinetStyles,
      } = action.payload;
      state.productIds = productIds;
      state.productOptions = productOptions;
      state.activeCabinetType = activeCabinetType;
      state.selectedDimensions = selectedDimensions;
      state.placedDividers = placedDividers ?? [];
      state.selectedProductConfig = selectedProductConfig ?? null;
      state.placedCabinetStyles = placedCabinetStyles ?? {};
      applyRulesToState(state);
    },
  },
});

export const {
  addProductId,
  addProductPreset,
  removeProductId,
  setPlacedCabinetStyle,
  swapProductIds,
  insertProductIdRelative,
  reset,
  setActiveCabinetType,
  setSelectedDimensions,
  setDrawerProduct,
  setSelectedProductConfig,
  setCabinetColor,
  setCabinetColorSku,
  setCabinetColorMaterial,
  setCabinetColorFinish,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  resetProducts,
  setActiveBasinStyle,
  setActiveCountertopColor,
  setCountertopColorSku,
  setVesselColor,
  setActiveCountertopThickness,
  setDrawerPanelFluting,
  setGrainDirection,
  setBookMatching,
  setCountertopStyle,
  setSidePanelsOption,
  setSidePanelSideStatus,
  setLedOption,
  setDividersOption,
  setDividersStyle,
  addPlacedDivider,
  removePlacedDivider,
  clearPlacedDividers,
  setTowelBarOption,
  setTowelBarColor,
  setFaucetHolesAmount,
  setFaucetHolesSpacing,
  resetPrebuiltProducts,
  setCabinetCatalog,
  setSelectedSceneProduct,
  setIsDrawerOpen,
  resetCabinetBuilderBootstrap,
  setHasBootstrappedCabinetBuilder,
  restoreProductState,
  updateAllPlacedCabinetStyles,
  switchAllCabinetsDrawerStyle,
} = productSlice.actions;
export const productReducer = productSlice.reducer;
