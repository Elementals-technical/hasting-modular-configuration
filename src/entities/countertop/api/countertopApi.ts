import { baseApi } from "@/shared";

import { routes } from "./routes";

import type { CountertopDatatable, CountertopSkuPriceResponse } from "./types";

export const countertopApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCountertopDatatable: builder.query<CountertopDatatable, string | number>({
      query: (id) => ({
        url: routes.datatableById(id),
      }),
    }),
    getCountertopTopPriceBySku: builder.query<CountertopSkuPriceResponse, { sku: string; widthCm: number }>({
      query: ({ sku, widthCm }) => ({
        url: routes.priceByCountertopTopSku(sku, widthCm),
      }),
    }),
  }),
});

export const {
  useGetCountertopDatatableQuery,
  useLazyGetCountertopDatatableQuery,
  useGetCountertopTopPriceBySkuQuery,
  useLazyGetCountertopTopPriceBySkuQuery,
} = countertopApi;
