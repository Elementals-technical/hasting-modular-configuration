import { baseApi } from "@/shared";
import { CONFIGURATOR_TAG } from "@/shared/api/tags";

import { routes } from "./routes";

import type { Configurator, GetConfiguratorQueryArg } from "./types";

export const configuratorApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConfigurator: builder.query<Configurator, GetConfiguratorQueryArg>({
      query: (arg) => {
        const params = typeof arg === "object" ? arg : { id: arg };
        const { id, view = "short", serialize = true } = params;

        return {
          url: routes.byId(id),
          params: {
            serialize,
            view,
          },
        };
      },
      providesTags: (_result, _error, arg) => {
        const id = typeof arg === "object" ? arg.id : arg;
        return [{ type: CONFIGURATOR_TAG, id }];
      },
    }),
  }),
});

export const { useGetConfiguratorQuery, useLazyGetConfiguratorQuery } = configuratorApi;
