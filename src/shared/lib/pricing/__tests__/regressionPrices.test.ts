import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  derivePriceStatus,
  priceStoreReducer,
  setPricingLines,
  setSkuPriceEntries,
  type SkuPriceEntry,
} from "@/entities/product/model/store/priceStore";

import { buildPricingLines } from "../buildPricingLines";
import { resolvePriceFromResponse } from "../priceRequests";
import composition60 from "./fixtures/prices/custom-composition-60.json";
import composition80 from "./fixtures/prices/custom-composition-80.json";
import prebuiltSet from "./fixtures/prices/prebuilt-set-with-added-cabinet.json";
import vesselTop from "./fixtures/prices/custom-vessel.json";
import { PRICING_SCENARIOS, type PricingScenarioId } from "./fixtures/pricingScenarios";

/**
 * The priced order of each reference scenario, against the recorded API answers (D03).
 *
 * The answers in `fixtures/prices/` are what the pricing API returned for these SKUs; the totals
 * below are what the app charges for them. A changed quantity, a lost line or a changed sum fails
 * here, and a line the server cannot price keeps the total incomplete rather than silently lower.
 */

type RecordedPrices = { scenario: string; recordedAt: string; answers: Record<string, Record<string, unknown>> };

const RECORDED: Record<PricingScenarioId, RecordedPrices> = {
  "custom-composition-60": composition60 as RecordedPrices,
  "custom-composition-80": composition80 as RecordedPrices,
  "custom-vessel": vesselTop as RecordedPrices,
  "prebuilt-set-with-added-cabinet": prebuiltSet as RecordedPrices,
};

const EXPECTED = {
  "custom-composition-60": { total: 14661, status: "ready" },
  "custom-composition-80": { total: 16073, status: "ready" },
  // The vessel itself has no price in the table, so the total stays incomplete.
  "custom-vessel": { total: 7756, status: "partial" },
  "prebuilt-set-with-added-cabinet": { total: 13372, status: "ready" },
} as const;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

const entriesOf = (scenario: PricingScenarioId, unpricedSku?: string): Record<string, SkuPriceEntry> =>
  Object.fromEntries(
    Object.entries(RECORDED[scenario].answers).map(([sku, answer]) => {
      const price = sku === unpricedSku ? null : resolvePriceFromResponse(answer);
      return [sku, typeof price === "number" ? { status: "ready", value: price } : { status: "missing" }];
    }),
  );

const priceScenario = (scenario: PricingScenarioId, unpricedSku?: string) => {
  const lines = buildPricingLines(PRICING_SCENARIOS[scenario].input);
  const actions = [setPricingLines(lines), setSkuPriceEntries(entriesOf(scenario, unpricedSku))];

  return actions.reduce(
    (state, action) => priceStoreReducer(state, action),
    priceStoreReducer(undefined, { type: "init" }),
  );
};

describe("USH price regression", () => {
  it.each(Object.keys(EXPECTED) as PricingScenarioId[])("charges the recorded prices of %s", (scenario) => {
    const state = priceScenario(scenario);

    expect(state.total).toBe(EXPECTED[scenario].total);
    expect(derivePriceStatus(state)).toBe(EXPECTED[scenario].status);
  });

  it.each(Object.keys(EXPECTED) as PricingScenarioId[])("counts every piece of %s once", (scenario) => {
    const lines = buildPricingLines(PRICING_SCENARIOS[scenario].input);
    const sumOverLines = lines.reduce((sum, { sku, quantity }) => {
      const price = resolvePriceFromResponse(RECORDED[scenario].answers[sku]);
      return sum + (typeof price === "number" ? price * quantity : 0);
    }, 0);

    expect(priceScenario(scenario).total).toBe(sumOverLines);
  });

  it("charges two identical cabinets twice", () => {
    const cabinetSku = "VAN-URSTD-SB/1DW/UG/X-23.6W-20.9H-19.7D-CAB-3D-1C1";
    const withCabinets = priceScenario("custom-composition-60");
    const withoutCabinetPrice = priceScenario("custom-composition-60", cabinetSku);

    expect(withCabinets.total - withoutCabinetPrice.total).toBe(2098 * 2);
    expect(derivePriceStatus(withoutCabinetPrice)).toBe("partial");
  });

  it("charges a wider composition more, on the countertop alone", () => {
    const narrow = priceScenario("custom-composition-60");
    const wide = priceScenario("custom-composition-80");

    // 80 cm cabinets cost more themselves; the countertop of the wider composition is 762 dearer.
    expect(wide.total - narrow.total).toBe(2423 * 2 - 2098 * 2 + (3847 - 3085));
  });

  it("leaves a failed price out of the total and marks it incomplete", () => {
    const topSku = "CT-URSSTKR-INTG-63.8W-.5H-19.9D-SSTKR-FF";
    const lines = buildPricingLines(PRICING_SCENARIOS["custom-composition-60"].input);
    const failed: Record<string, SkuPriceEntry> = {
      ...entriesOf("custom-composition-60"),
      [topSku]: { status: "error", message: "pricing resolver failed" },
    };
    const state = [setPricingLines(lines), setSkuPriceEntries(failed)].reduce(
      (current, action) => priceStoreReducer(current, action),
      priceStoreReducer(undefined, { type: "init" }),
    );

    expect(state.total).toBe(EXPECTED["custom-composition-60"].total - 3085);
    expect(derivePriceStatus(state)).toBe("partial");
  });

  it("prices faucet holes at zero without making the total incomplete", () => {
    const state = priceScenario("custom-composition-60");

    expect(state.entries["CT-URSSTKR-FAHO/0"]).toEqual({ status: "ready", value: 0 });
    expect(derivePriceStatus(state)).toBe("ready");
  });
});
