import { configureStore } from "@reduxjs/toolkit";

import { baseApi } from "@/shared";

import { rootReducer } from "./reducer";
import { optionsListenerMiddleware } from "./optionsListener";
import { bootstrapActiveCollection } from "./bootstrapCollection";

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    })
      .prepend(optionsListenerMiddleware.middleware)
      .concat(baseApi.middleware),
});

bootstrapActiveCollection(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
