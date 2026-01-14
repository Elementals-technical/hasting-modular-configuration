import { baseApi } from "@/shared";
import { CONFIGURATIONS_TAG } from "@/shared/api/tags";

import { routes } from "./routes";

import type { ConfigurationPayload, ConfigurationRecord } from "./types";

export const configurationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    saveConfiguration: builder.mutation<ConfigurationRecord, ConfigurationPayload>({
      query: (payload) => ({
        url: routes.save(),
        method: "POST",
        body: payload,
      }),
      invalidatesTags: [CONFIGURATIONS_TAG],
    }),
    restoreConfiguration: builder.query<ConfigurationRecord, string | number>({
      query: (id) => ({
        url: routes.byId(id),
      }),
      providesTags: (_result, _error, id) => [{ type: CONFIGURATIONS_TAG, id }],
    }),
    // listConfigurations: builder.query<ConfigurationRecord[], void>({
    //   query: () => ({
    //     url: routes.list(),
    //   }),
    //   providesTags: [CONFIGURATIONS_TAG],
    // }),
    // deleteConfiguration: builder.mutation<{ success?: boolean }, string | number>({
    //   query: (id) => ({
    //     url: routes.byId(id),
    //     method: "DELETE",
    //   }),
    //   invalidatesTags: [CONFIGURATIONS_TAG],
    // }),
  }),
});

export const {
  useSaveConfigurationMutation,
  // useListConfigurationsQuery,
  useRestoreConfigurationQuery,
  useLazyRestoreConfigurationQuery,
  // useDeleteConfigurationMutation,
} = configurationApi;
