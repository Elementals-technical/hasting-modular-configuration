import { baseApi } from "@/shared";

import { routes } from "./routes";

import type { CountertopDatatable } from "./types";

export const countertopApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCountertopDatatable: builder.query<CountertopDatatable, string | number>({
      query: (id) => ({
        url: routes.datatableById(id),
      }),
    }),
  }),
});

export const { useGetCountertopDatatableQuery, useLazyGetCountertopDatatableQuery } = countertopApi;
