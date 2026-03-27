import { priceStoreReducer } from "@/entities/product/model/store/priceStore";
import { productReducer } from "@/entities/product/model/store/slice";
import { historyReducer } from "@/entities/history/model/store/slice";
import { sidebarReducer } from "@/features/sidebar/model/store/slice";
import { swatchSidebarReducer } from "@/features/swatchSidebar/model/store/slice";
import { baseApi } from "@/shared";
import { combineReducers } from "@reduxjs/toolkit";

const rootReducerUI = combineReducers({
  sidebar: sidebarReducer,
  swatchSidebar: swatchSidebarReducer,
  product: productReducer,
  priceStore: priceStoreReducer,
  history: historyReducer,
});

export const rootReducer = combineReducers({
  rootStateUI: rootReducerUI,
  [baseApi.reducerPath]: baseApi.reducer,
});
