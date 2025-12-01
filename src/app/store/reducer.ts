import { usersUISlice } from "@/entities/user";
import { sidebarReducer } from "@/features/sidebar/model/store/slice";
import { baseApi } from "@/shared";
import { combineReducers } from "@reduxjs/toolkit";

const rootReducerUI = combineReducers({
  sidebar: sidebarReducer,
  [usersUISlice.name]: usersUISlice.reducer,
});

export const rootReducer = combineReducers({
  rootStateUI: rootReducerUI,
  [baseApi.reducerPath]: baseApi.reducer,
});
