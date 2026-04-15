import { priceStoreReducer } from "@/entities/product/model/store/priceStore";
import { productReducer } from "@/entities/product/model/store/slice";
import { historyReducer } from "@/entities/history/model/store/slice";
import { sidebarReducer } from "@/features/sidebar/model/store/slice";
import { swatchOrderReducer } from "@/features/swatchOrder";
import { baseApi } from "@/shared";
import { combineReducers } from "@reduxjs/toolkit";

const rootReducerUI = combineReducers({
  sidebar: sidebarReducer,
  swatchOrder: swatchOrderReducer,
  product: productReducer,
  priceStore: priceStoreReducer,
  history: historyReducer,
});

export const rootReducer = combineReducers({
  rootStateUI: rootReducerUI,
  [baseApi.reducerPath]: baseApi.reducer,
});
