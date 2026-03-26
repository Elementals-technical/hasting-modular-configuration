import { baseApi } from "@/shared";

import { routes } from "./routes";

import type { ProductDatatable, ProductSkuPriceResponse, SkuResolveResponse, SkuSearchResponse } from "./types";

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
    getProductPriceBySkuV2Resolve: builder.query<ProductSkuPriceResponse, string>({
      query: (sku) => ({
        url: routes.priceBySkuV2Resolve(sku),
      }),
    }),
    resolveSkuPrice: builder.query<SkuResolveResponse, { containerId: string | number; sku: string }>({
      query: ({ containerId, sku }) => ({
        url: routes.resolveSkuPrice(containerId, sku),
      }),
    }),
    debugSkuSearch: builder.query<SkuSearchResponse, { tableId: string | number; searchParts: string[] }>({
      query: ({ tableId, searchParts }) => ({
        url: routes.debugSkuSearch(tableId, searchParts),
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
  useResolveSkuPriceQuery,
  useLazyResolveSkuPriceQuery,
  useDebugSkuSearchQuery,
  useLazyDebugSkuSearchQuery,
} = productApi;
