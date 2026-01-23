import { baseApi } from "@/shared";
import { CONFIGURATOR_TAG } from "@/shared/api/tags";

import { routes } from "./routes";

import type { Configurator, GetConfiguratorArgs } from "./types";

export const configuratorApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConfigurator: builder.query<Configurator, GetConfiguratorArgs>({
      query: ({ id, view = "short", serialize = true }) => ({
        url: routes.byId(id),
        params: {
          serialize,
          view,
        },
      }),
      providesTags: (_result, _error, args) => [{ type: CONFIGURATOR_TAG, id: args.id }],
    }),
  }),
});

export const { useGetConfiguratorQuery, useLazyGetConfiguratorQuery } = configuratorApi;
