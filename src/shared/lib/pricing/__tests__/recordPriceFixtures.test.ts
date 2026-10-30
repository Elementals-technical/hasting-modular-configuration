import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { ushSkuProfile } from "@/shared/lib/sku/__tests__/ushSkuProfileFixture";

import { buildCollectionPricingLines } from "../buildCollectionPricingLines";
import { buildPricingLines } from "../buildPricingLines";
import { resolvePriceRequest } from "../priceRequests";
import type { PricingLine } from "../types";
import { COLLECTION_PRICING_SCENARIOS, COLLECTION_PRICING_SCENARIO_IDS } from "./fixtures/collectionPricingScenarios";
import { PRICING_SCENARIOS, PRICING_SCENARIO_IDS } from "./fixtures/pricingScenarios";

/**
 * Records the price answers of the reference scenarios (D03). Off by default; the regression
 * tests read the recorded files and never reach the network.
 *
 *   RECORD_PRICES=1 npx vitest run src/shared/lib/pricing/__tests__/recordPriceFixtures.test.ts
 */

const PRICE_URL = "https://renderadmin.vivid3d.tech/pricing-v2/resolve";
const OUT_DIR = fileURLToPath(new URL("./fixtures/prices/", import.meta.url));
const USH = {
  countertopPrefix: ushSkuProfile.series.countertopPrefix,
  bookMatchingSkuPrefix: `VAN-${ushSkuProfile.series.bookMatching}-`,
};

/** The app keeps `/` unescaped in SKU query values (see entities/product/api/routes.ts). */
const encodeSku = (sku: string) => encodeURIComponent(sku).replace(/%2F/gi, "/");

/** Asks for each SKU once, as `usePriceCalculation` does, and writes the answers of one scenario. */
const recordAnswers = async (scenario: string, requestBySku: Map<string, string>) => {
  const answers: Record<string, unknown> = {};
  for (const [sku, url] of requestBySku) {
    const response = await fetch(url);
    answers[sku] = await response.json();
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    `${OUT_DIR}${scenario}.json`,
    `${JSON.stringify({ scenario, recordedAt: new Date().toISOString().slice(0, 10), answers }, null, 2)}\n`,
  );

  return answers;
};

/** A collection priced from its SKU profile prices its top per cm of the composition (D04). */
const collectionRequests = (lines: readonly PricingLine[]) =>
  new Map(
    lines.map(({ sku, group, widthCm }) => {
      const request = resolvePriceRequest({
        sku,
        widthCm,
        countertopPrefix: null,
        bookMatchingSkuPrefix: null,
        pricedPerCm: group === "countertop",
      });
      const widthParam = request.kind === "countertopTop" ? `&widthCm=${request.widthCm}` : "";
      return [sku, `${PRICE_URL}?sku=${encodeSku(sku)}${widthParam}`];
    }),
  );

describe.skipIf(process.env.RECORD_PRICES !== "1")("record price fixtures", () => {
  it.each(PRICING_SCENARIO_IDS)(
    "records the price answers of %s",
    async (scenario) => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);

      const lines = buildPricingLines(PRICING_SCENARIOS[scenario].input);
      const requestBySku = new Map<string, string>();

      lines.forEach((line) => {
        if (requestBySku.has(line.sku)) return;
        const request = resolvePriceRequest({ sku: line.sku, widthCm: line.widthCm, ...USH });
        const widthParam = request.kind === "countertopTop" ? `&widthCm=${request.widthCm}` : "";
        requestBySku.set(line.sku, `${PRICE_URL}?sku=${encodeSku(line.sku)}${widthParam}`);
      });

      const answers = await recordAnswers(scenario, requestBySku);

      expect(Object.keys(answers)).toHaveLength(requestBySku.size);
    },
    120_000,
  );

  it.each(COLLECTION_PRICING_SCENARIO_IDS)(
    "records the price answers of %s",
    async (scenario) => {
      const { lines } = buildCollectionPricingLines(COLLECTION_PRICING_SCENARIOS[scenario].input);
      const requestBySku = collectionRequests(lines);

      const answers = await recordAnswers(scenario, requestBySku);

      expect(Object.keys(answers)).toHaveLength(requestBySku.size);
    },
    120_000,
  );
});
