import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { AR_CONFIGURATIONS_TAG, CONFIGURATIONS_TAG } from "./tags";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    prepareHeaders: (headers) => {
      if (import.meta.env.VITE_MODULAR_API_TOKEN) {
        headers.set("Authorization", import.meta.env.VITE_MODULAR_API_TOKEN);
      }

      return headers;
    },
  }),
  tagTypes: [CONFIGURATIONS_TAG, AR_CONFIGURATIONS_TAG],
  endpoints: () => ({}),
});

export type BaseApiType = typeof baseApi;
