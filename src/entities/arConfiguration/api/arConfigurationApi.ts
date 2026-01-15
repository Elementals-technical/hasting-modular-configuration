import { baseApi } from "@/shared";
import { AR_CONFIGURATIONS_TAG } from "@/shared/api/tags";

import { routes } from "./routes";

import type { ArConfigurationPayload, ArConfigurationRecord } from "./types";

const buildFormData = (payload: ArConfigurationPayload) => {
  const formData = new FormData();

  formData.append("configuration", JSON.stringify(payload.configuration));

  if (payload.glb) {
    formData.append("glb", payload.glb, payload.glb.name);
  }

  if (payload.usdz) {
    formData.append("usdz", payload.usdz, payload.usdz.name);
  }

  return formData;
};

export const arConfigurationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createArConfiguration: builder.mutation<ArConfigurationRecord, ArConfigurationPayload>({
      query: (payload) => ({
        url: routes.create(),
        method: "POST",
        body: buildFormData(payload),
      }),
      invalidatesTags: [AR_CONFIGURATIONS_TAG],
    }),
    // listArConfigurations: builder.query<ArConfigurationRecord[], void>({
    //   query: () => ({
    //     url: routes.list(),
    //   }),
    //   providesTags: [AR_CONFIGURATIONS_TAG],
    // }),
    getArConfiguration: builder.query<ArConfigurationRecord, string | number>({
      query: (id) => ({
        url: routes.byId(id),
      }),
      providesTags: (_result, _error, id) => [{ type: AR_CONFIGURATIONS_TAG, id }],
    }),
    // deleteArConfiguration: builder.mutation<{ success?: boolean }, string | number>({
    //   query: (id) => ({
    //     url: routes.byId(id),
    //     method: "DELETE",
    //   }),
    //   invalidatesTags: [AR_CONFIGURATIONS_TAG],
    // }),
    queryArConfiguration: builder.query<ArConfigurationRecord, Record<string, unknown>>({
      query: (configuration) => ({
        url: routes.query(),
        params: { configuration: JSON.stringify(configuration) },
      }),
      providesTags: [AR_CONFIGURATIONS_TAG],
    }),
  }),
});

export const {
  useCreateArConfigurationMutation,
  // useListArConfigurationsQuery,
  useGetArConfigurationQuery,
  // useDeleteArConfigurationMutation,
  useQueryArConfigurationQuery,
  useLazyQueryArConfigurationQuery,
} = arConfigurationApi;
