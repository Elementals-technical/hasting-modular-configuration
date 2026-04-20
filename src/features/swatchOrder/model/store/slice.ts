import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { uniqueList } from "../../lib/uniqueList";
import { MAX_SLOTS } from "../constants";
import type {
  AttributeValue,
  IMapUIData,
  IProductElementOption,
  ISetFiltersPayload,
  ISwatchOrderSlice,
} from "../types";

const createInitialState = (): ISwatchOrderSlice => ({
  isOpen: false,
  activeProductElement: null,
  productElementOptions: [],
  allMaterialsValues: [],
  materialSelectState: { Finish: [], Color: [], Look: [] },
  selectedMaterials: [],
  manualSelectedMaterials: [],
  isEnabledInSummary: true,
  isAutofillEnabled: true,
  hasSubmittedCart: false,
});

const initialState = createInitialState();

const sum = (arr: AttributeValue[]) => arr.reduce((s, i) => s + (i.count ?? 0), 0);

const isSame = (a: AttributeValue, b: AttributeValue) =>
  a.metadata?.label === b.metadata?.label && a.parentName === b.parentName;

const isSameList = (a: AttributeValue[], b: AttributeValue[]) =>
  a.length === b.length && a.every((item, index) => {
    const other = b[index];
    return Boolean(other) && isSame(item, other);
  });

const swatchOrderSlice = createSlice({
  name: "swatchOrder",
  initialState,
  reducers: {
    openSwatchOrder(state, action: PayloadAction<string | undefined>) {
      state.isOpen = true;
      state.activeProductElement = action.payload ?? null;
      state.materialSelectState = { Finish: [], Color: [], Look: [] };
    },
    closeSwatchOrder(state) {
      state.isOpen = false;
    },
    setAllMaterialsOptions(state, action: PayloadAction<IMapUIData>) {
      const { allMaterialValues, productElementOptions } = action.payload;
      state.allMaterialsValues = allMaterialValues;
      state.productElementOptions = productElementOptions;
    },
    setPanelFilter(state, action: PayloadAction<{ attributes: IProductElementOption[] }>) {
      const list = action.payload.attributes;
      if (list.length) {
        state.allMaterialsValues = list.flatMap((group) => group.valuesArray);
      }
    },
    setMaterialSelect(state, action: PayloadAction<ISetFiltersPayload>) {
      const { filterName, values } = action.payload;
      state.materialSelectState[filterName] = values.length ? uniqueList(values) : [];
    },
    setSelectedMaterial(state, action: PayloadAction<{ selectedMaterial: AttributeValue }>) {
      const { selectedMaterial } = action.payload;
      if (!selectedMaterial) return;

      const target = { ...selectedMaterial, count: 1, selectionSource: "manual" as const };
      const existingIdx = state.manualSelectedMaterials.findIndex((i) => isSame(i, target));
      if (existingIdx >= 0) {
        state.manualSelectedMaterials.splice(existingIdx, 1);
        if (!state.isAutofillEnabled) {
          state.selectedMaterials = state.manualSelectedMaterials.slice();
        }
      } else if (sum(state.selectedMaterials) < MAX_SLOTS) {
        state.manualSelectedMaterials.push(target);
        if (!state.isAutofillEnabled) {
          state.selectedMaterials = state.manualSelectedMaterials.slice();
        }
      }
      if (state.selectedMaterials.length === 0) state.hasSubmittedCart = false;
    },
    removeItem(state, action: PayloadAction<{ selectedMaterial: AttributeValue }>) {
      state.manualSelectedMaterials = state.manualSelectedMaterials.filter(
        (i) => !isSame(i, action.payload.selectedMaterial),
      );
      if (!state.isAutofillEnabled) {
        state.selectedMaterials = state.selectedMaterials.filter(
          (i) => !isSame(i, action.payload.selectedMaterial),
        );
      }
      if (state.selectedMaterials.length === 0) state.hasSubmittedCart = false;
    },
    setCartMaterials(state, action: PayloadAction<AttributeValue[]>) {
      if (isSameList(state.selectedMaterials, action.payload)) return;
      state.selectedMaterials = action.payload;
      if (action.payload.length === 0) state.hasSubmittedCart = false;
    },
    markCartSubmitted(state) {
      state.hasSubmittedCart = state.selectedMaterials.length > 0;
    },
    setSwatchesEnabledInSummary(state, action: PayloadAction<boolean>) {
      state.isEnabledInSummary = action.payload;
    },
    setAutofillEnabled(state, action: PayloadAction<boolean>) {
      state.isAutofillEnabled = action.payload;
      if (action.payload) {
        state.isEnabledInSummary = true;
      }
      if (!action.payload) {
        state.selectedMaterials = state.manualSelectedMaterials.slice();
        state.hasSubmittedCart = false;
      }
    },
    hydrateSwatchOrder(
      state,
      action: PayloadAction<{
        selectedMaterials: AttributeValue[];
        manualSelectedMaterials: AttributeValue[];
        isAutofillEnabled: boolean;
        hasSubmittedCart: boolean;
      }>,
    ) {
      state.selectedMaterials = action.payload.selectedMaterials;
      state.manualSelectedMaterials = action.payload.manualSelectedMaterials;
      state.isAutofillEnabled = action.payload.isAutofillEnabled;
      state.hasSubmittedCart = action.payload.hasSubmittedCart;
    },
    resetSwatchOrder() {
      return createInitialState();
    },
  },
});

export const {
  openSwatchOrder,
  closeSwatchOrder,
  setAllMaterialsOptions,
  setPanelFilter,
  setMaterialSelect,
  setSelectedMaterial,
  removeItem,
  setCartMaterials,
  markCartSubmitted,
  setSwatchesEnabledInSummary,
  setAutofillEnabled,
  hydrateSwatchOrder,
  resetSwatchOrder,
} = swatchOrderSlice.actions;

export const swatchOrderReducer = swatchOrderSlice.reducer;
