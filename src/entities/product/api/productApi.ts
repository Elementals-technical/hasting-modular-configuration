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
    getProductPriceBySkuV2Resolve: builder.query<
      ProductSkuPriceResponse,
      { sku: string; widthCm?: number }
    >({
      query: ({ sku, widthCm }) => ({
        url: routes.priceBySkuV2Resolve(sku, widthCm),
      }),
    }),
  }),
});

export const {
  useGetProductDatatableQuery,
  useLazyGetProductDatatableQuery,
  useGetProductPriceBySkuQuery,
  useLazyGetProductPriceBySkuQuery,
  useGetProductPriceBySkuV2ResolveQuery,
  useLazyGetProductPriceBySkuV2ResolveQuery,
} = productApi;
