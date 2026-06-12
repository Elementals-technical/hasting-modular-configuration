import { configureStore } from "@reduxjs/toolkit";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { baseApi } from "@/shared";
import { countertopApi } from "../countertopApi";
import { routes } from "../routes";

import type { CountertopDatatable, CountertopSkuPriceResponse } from "../types";

const renderAdminBaseUrl = "https://renderadmin.vivid3d.tech";
const dynamicTopSku = "CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FF";
const widthCm = 191;

const server = setupServer();

const createApiStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

const buildPriceResponse = (candidateWidthCm: number): CountertopSkuPriceResponse => ({
  price: 1275,
  resolver: "price_per_unit",
  error: null,
  metadata: {
    widthCm: candidateWidthCm,
  },
  parsed: {
    sku: dynamicTopSku,
  },
});

const datatableResponse: CountertopDatatable = {
  id: 42,
  name: "Countertop test datatable",
  description: null,
  schema: [
    {
      name: "sku",
      type: "string",
    },
  ],
  rows: [
    {
      sku: dynamicTopSku,
    },
  ],
  organizationId: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => server.close());

describe("countertop top pricing API", () => {
  it("requests a countertop datatable by id through RTK Query", async () => {
    const capturedRequest: { url?: URL } = {};
    const store = createApiStore();

    server.use(
      http.get(`${renderAdminBaseUrl}/datatables/:id`, ({ request }) => {
        capturedRequest.url = new URL(request.url);
        return HttpResponse.json(datatableResponse);
      }),
    );

    const result = await store.dispatch(countertopApi.endpoints.getCountertopDatatable.initiate(42));

    expect(result.data).toMatchObject({
      id: 42,
      name: "Countertop test datatable",
      description: null,
      schema: [
        {
          name: "sku",
          type: "string",
        },
      ],
      rows: [
        {
          sku: dynamicTopSku,
        },
      ],
      organizationId: 7,
    });
    expect(result.error).toBeUndefined();

    if (!capturedRequest.url) {
      throw new Error("MSW handler did not capture the countertop datatable request");
    }

    expect(capturedRequest.url.pathname).toBe("/datatables/42");
    expect([...capturedRequest.url.searchParams.keys()]).toEqual([]);

    store.dispatch(baseApi.util.resetApiState());
  });

  it("builds the dynamic top resolver route with sku and widthCm", () => {
    expect(routes.priceByCountertopTopSku(dynamicTopSku, widthCm)).toBe(
      `${renderAdminBaseUrl}/pricing-v2/resolve?sku=${dynamicTopSku}&widthCm=${widthCm}`,
    );
  });

  it.each([1, 87, 191])("keeps numeric widthCm=%i in the dynamic top resolver route", (candidateWidthCm) => {
    expect(routes.priceByCountertopTopSku(dynamicTopSku, candidateWidthCm)).toBe(
      `${renderAdminBaseUrl}/pricing-v2/resolve?sku=${dynamicTopSku}&widthCm=${candidateWidthCm}`,
    );
  });

  it("preserves slash characters in encoded SKU query values", () => {
    const skuWithSlash = "CT-URSSTKR-INTG-75.2W-.5H-19.9D-SSTKR-FA/HO";

    expect(routes.priceByCountertopTopSku(skuWithSlash, 87)).toBe(
      `${renderAdminBaseUrl}/pricing-v2/resolve?sku=${skuWithSlash}&widthCm=87`,
    );
  });

  it.each([1, 87, 191])(
    "requests the dynamic top resolver through RTK Query with widthCm=%i",
    async (candidateWidthCm) => {
      const capturedRequest: { url?: URL } = {};
      const store = createApiStore();
      const priceResponse = buildPriceResponse(candidateWidthCm);

      server.use(
        http.get(`${renderAdminBaseUrl}/pricing-v2/resolve`, ({ request }) => {
          capturedRequest.url = new URL(request.url);
          return HttpResponse.json(priceResponse);
        }),
      );

      const result = await store.dispatch(
        countertopApi.endpoints.getCountertopTopPriceBySku.initiate({
          sku: dynamicTopSku,
          widthCm: candidateWidthCm,
        }),
      );

      expect(result.data).toEqual(priceResponse);
      expect(result.error).toBeUndefined();

      if (!capturedRequest.url) {
        throw new Error("MSW handler did not capture the dynamic top pricing request");
      }

      expect(capturedRequest.url.pathname).toBe("/pricing-v2/resolve");
      expect(capturedRequest.url.searchParams.get("sku")).toBe(dynamicTopSku);
      expect(capturedRequest.url.searchParams.get("widthCm")).toBe(String(candidateWidthCm));
      expect([...capturedRequest.url.searchParams.keys()].sort()).toEqual(["sku", "widthCm"]);

      store.dispatch(baseApi.util.resetApiState());
    },
  );

  it("surfaces resolver errors without changing route builder behavior", async () => {
    const store = createApiStore();

    server.use(
      http.get(`${renderAdminBaseUrl}/pricing-v2/resolve`, () =>
        HttpResponse.json({ message: "pricing resolver failed" }, { status: 500 }),
      ),
    );

    const result = await store.dispatch(
      countertopApi.endpoints.getCountertopTopPriceBySku.initiate({
        sku: dynamicTopSku,
        widthCm,
      }),
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(routes.priceByCountertopTopSku(dynamicTopSku, widthCm)).toBe(
      `${renderAdminBaseUrl}/pricing-v2/resolve?sku=${dynamicTopSku}&widthCm=${widthCm}`,
    );

    store.dispatch(baseApi.util.resetApiState());
  });
});
