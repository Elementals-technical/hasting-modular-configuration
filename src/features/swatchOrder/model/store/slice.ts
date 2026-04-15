import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { uniqueList } from "../../lib/uniqueList";
import { StorageService } from "../../lib/storageService";
import { MAX_SLOTS } from "../constants";
import type {
  AttributeValue,
  IMapUIData,
  IProductElementOption,
  ISetFiltersPayload,
  ISwatchOrderSlice,
} from "../types";

const persistedState = StorageService.getState();

const initialSelected =
  persistedState.isAutofillEnabled || persistedState.hasSubmittedCart
    ? persistedState.selectedMaterials
    : [];

const initialState: ISwatchOrderSlice = {
  isOpen: false,
  activeProductElement: null,
  productElementOptions: [],
  allMaterialsValues: [],
  materialSelectState: { Finish: [], Color: [], Look: [] },
  selectedMaterials: initialSelected,
  isEnabledInSummary: true,
  isAutofillEnabled: persistedState.isAutofillEnabled,
  hasSubmittedCart: persistedState.hasSubmittedCart && initialSelected.length > 0,
};

const sum = (arr: AttributeValue[]) => arr.reduce((s, i) => s + (i.count ?? 0), 0);

const isSame = (a: AttributeValue, b: AttributeValue) =>
  a.metadata?.label === b.metadata?.label && a.parentName === b.parentName;

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

      const existingIdx = state.selectedMaterials.findIndex((i) => isSame(i, selectedMaterial));
      if (existingIdx >= 0) {
        state.selectedMaterials.splice(existingIdx, 1);
      } else if (sum(state.selectedMaterials) < MAX_SLOTS) {
        state.selectedMaterials.push({ ...selectedMaterial, count: 1 });
      }
      if (state.selectedMaterials.length === 0) state.hasSubmittedCart = false;
    },
    removeItem(state, action: PayloadAction<{ selectedMaterial: AttributeValue }>) {
      state.selectedMaterials = state.selectedMaterials.filter(
        (i) => !isSame(i, action.payload.selectedMaterial),
      );
      if (state.selectedMaterials.length === 0) state.hasSubmittedCart = false;
    },
    setCartMaterials(state, action: PayloadAction<AttributeValue[]>) {
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
      if (!action.payload) {
        state.selectedMaterials = [];
        state.hasSubmittedCart = false;
      }
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
} = swatchOrderSlice.actions;

export const swatchOrderReducer = swatchOrderSlice.reducer;
