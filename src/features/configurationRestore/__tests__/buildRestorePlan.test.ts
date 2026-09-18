import { describe, expect, it } from "vitest";

import type { ConfigurationRecord } from "@/entities/configuration";

import { buildRestorePlan } from "../lib/buildRestorePlan";

const savedRecord = (): ConfigurationRecord => ({
  configuration: {
    "Sink-Base-aaa111": { ProductType: "Sink-Base", Width: 60 },
    "Top_Solid-ccc333": { productType: "Top_Solid", Width: 140 },
    "Sink-Cabinet-bbb222": { ProductType: "Sink-Cabinet", Width: 80 },
  },
  metadata: {
    path: "/custom/summary",
    orderedProductIds: ["Sink-Base-aaa111", "Sink-Cabinet-bbb222", "Top_Solid-ccc333"],
    collectionId: "urban-standard-height",
    uiState: { CabinetColor: "Pulpis Chiaro TKH" },
    configuration: {
      version: 1,
      collectionId: "urban-standard-height",
      cabinets: [
        { stableKey: "cab-4", index: 0 },
        { stableKey: "cab-7", index: 1 },
      ],
      values: {},
    },
  },
});

const issueCodes = (result: ReturnType<typeof buildRestorePlan>) =>
  result.ok ? [] : result.issues.map(({ code }) => code);

describe("buildRestorePlan", () => {
  it("lists the cabinets in saved order and keeps countertop parts apart", () => {
    const result = buildRestorePlan("13507", savedRecord());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.products.map(({ sourceId, productType }) => [sourceId, productType])).toEqual([
      ["Sink-Base-aaa111", "Sink-Base"],
      ["Sink-Cabinet-bbb222", "Sink-Cabinet"],
    ]);
    expect(result.plan.topConfigs.map(({ sourceId }) => sourceId)).toEqual(["Top_Solid-ccc333"]);
    expect(result.plan).toMatchObject({
      configId: "13507",
      path: "/custom/summary",
      isLegacy: false,
      uiState: { CabinetColor: "Pulpis Chiaro TKH" },
      warnings: [],
    });
  });

  it("reads a payload saved before the fragment as legacy", () => {
    const record = savedRecord();
    delete record.metadata.configuration;
    delete record.metadata.collectionId;

    const result = buildRestorePlan("13507", record);

    expect(result).toMatchObject({ ok: true, plan: { isLegacy: true, warnings: [] } });
  });

  it("uses the config order when the payload has no saved order", () => {
    const record = savedRecord();
    delete record.metadata.orderedProductIds;

    const result = buildRestorePlan("13507", record);

    expect(result.ok && result.plan.products.map(({ sourceId }) => sourceId)).toEqual([
      "Sink-Base-aaa111",
      "Sink-Cabinet-bbb222",
    ]);
  });

  it("rejects a payload without product configs", () => {
    const record = { ...savedRecord(), configuration: null } as unknown as ConfigurationRecord;

    expect(issueCodes(buildRestorePlan("13507", record))).toEqual(["record.invalid-configuration"]);
  });

  it("rejects a saved order that names a product without config", () => {
    const record = savedRecord();
    record.metadata.orderedProductIds = ["Sink-Base-aaa111", "Sink-Base-gone999"];

    expect(issueCodes(buildRestorePlan("13507", record))).toEqual(["record.missing-product"]);
  });

  it("rejects a payload with only countertop parts", () => {
    const record = savedRecord();
    record.metadata.orderedProductIds = ["Top_Solid-ccc333"];

    expect(issueCodes(buildRestorePlan("13507", record))).toEqual(["record.no-cabinets"]);
  });

  it("rejects an unreadable fragment and only warns about a newer one", () => {
    const malformed = savedRecord();
    malformed.metadata.configuration = "broken";
    expect(issueCodes(buildRestorePlan("13507", malformed))).toEqual(["fragment.malformed"]);

    const newer = savedRecord();
    newer.metadata.configuration = { ...(newer.metadata.configuration as object), version: 99 };
    expect(buildRestorePlan("13507", newer)).toMatchObject({
      ok: true,
      plan: { warnings: [{ code: "fragment.newer-version" }] },
    });
  });

  it("rejects malformed v2 values before any scene restore can start", () => {
    const record = savedRecord();
    record.metadata.configuration = {
      ...(record.metadata.configuration as object),
      version: 2,
      values: { basin: { sinkType: "Vessel" } },
    };

    expect(issueCodes(buildRestorePlan("13507", record))).toEqual(["fragment.invalid-values"]);
  });
});
