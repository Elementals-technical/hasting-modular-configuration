import { usersUISlice } from "@/entities/user";
import { productReducer } from "@/entities/product/model/store/slice";
import { sidebarReducer } from "@/features/sidebar/model/store/slice";
import { baseApi } from "@/shared";
import { combineReducers } from "@reduxjs/toolkit";

const rootReducerUI = combineReducers({
  sidebar: sidebarReducer,
  product: productReducer,
  [usersUISlice.name]: usersUISlice.reducer,
});

export const rootReducer = combineReducers({
  rootStateUI: rootReducerUI,
  [baseApi.reducerPath]: baseApi.reducer,
});
