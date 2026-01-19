import { baseApi } from "@/shared";

import { routes } from "./routes";

import type { ProductDatatable } from "./types";

export const productApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProductDatatable: builder.query<ProductDatatable, string | number>({
      query: (id) => ({
        url: routes.datatableById(id),
      }),
    }),
  }),
});

export const { useGetProductDatatableQuery, useLazyGetProductDatatableQuery } = productApi;
