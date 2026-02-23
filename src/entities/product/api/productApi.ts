import { baseApi } from "@/shared";

import { routes } from "./routes";

import type { ProductDatatable, ProductSkuPriceResponse } from "./types";

export const productApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProductDatatable: builder.query<ProductDatatable, string | number>({
      query: (id) => ({
        url: routes.datatableById(id),
      }),
    }),
    getProductPriceBySku: builder.query<ProductSkuPriceResponse, string>({
      query: (sku) => ({
        url: routes.priceBySku(sku),
      }),
    }),
  }),
});

export const {
  useGetProductDatatableQuery,
  useLazyGetProductDatatableQuery,
  useGetProductPriceBySkuQuery,
  useLazyGetProductPriceBySkuQuery,
} = productApi;
