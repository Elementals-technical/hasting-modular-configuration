import { beforeEach, describe, expect, it, vi } from "vitest";

const sceneMocks = vi.hoisted(() => ({
  getOrderedProductIds: vi.fn<(fallback?: string[]) => string[]>(),
  getConfig: vi.fn<(id: string) => Promise<Record<string, unknown> | null>>(),
}));

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: sceneMocks.getOrderedProductIds,
}));

vi.mock("@/utils/functions/playcanvas/getConfig", () => ({
  getConfig: sceneMocks.getConfig,
}));

import { collectSceneConfiguration } from "../lib/collectSceneConfiguration";
import { hashConfigurationRequest } from "../hooks/useSaveCurrentConfiguration";
import type { ConfigurationMetadata } from "../lib/buildConfigurationMetadata";

describe("collectSceneConfiguration", () => {
  beforeEach(() => {
    sceneMocks.getOrderedProductIds.mockReset();
    sceneMocks.getConfig.mockReset();
  });

  it("keys the configuration by runtime id in composition order", async () => {
    sceneMocks.getOrderedProductIds.mockReturnValue(["rt-b", "rt-a"]);
    sceneMocks.getConfig.mockImplementation(async (id) => ({ name: id }));

    const result = await collectSceneConfiguration();

    expect(result.orderedProductIds).toEqual(["rt-b", "rt-a"]);
    expect(result.configuration).toEqual({ "rt-b": { name: "rt-b" }, "rt-a": { name: "rt-a" } });
  });

  it("passes the fallback ids to the scene", async () => {
    sceneMocks.getOrderedProductIds.mockReturnValue(["rt-a"]);
    sceneMocks.getConfig.mockResolvedValue({});

    await collectSceneConfiguration(["fallback-1"]);

    expect(sceneMocks.getOrderedProductIds).toHaveBeenCalledWith(["fallback-1"]);
  });

  it("asks the scene for nothing when there are no products", async () => {
    sceneMocks.getOrderedProductIds.mockReturnValue([]);

    const result = await collectSceneConfiguration();

    expect(result).toEqual({ orderedProductIds: [], configuration: {} });
    expect(sceneMocks.getConfig).not.toHaveBeenCalled();
  });
});

describe("hashConfigurationRequest", () => {
  const metadata = (savedAt: string): ConfigurationMetadata => ({
    path: "/custom/summary",
    savedAt,
    orderedProductIds: ["rt-a"],
    collectionId: "urban-standard-height",
    uiState: { CabinetColor: "Pulpis Chiaro TKH" } as ConfigurationMetadata["uiState"],
    swatchOrder: {
      selectedMaterials: [],
      manualSelectedMaterials: [],
      isAutofillEnabled: false,
      hasSubmittedCart: false,
    },
    configuration: { version: 1, collectionId: "urban-standard-height", cabinets: [], values: {} },
  });

  it("ignores the timestamp so an unchanged configuration is not saved twice", () => {
    // Hashing the whole request never matched, because `savedAt` is regenerated on each
    // build — the de-duplication guard in the summary pages silently did nothing.
    const first = hashConfigurationRequest({ configuration: { a: 1 }, metadata: metadata("2026-01-01T00:00:00Z") });
    const second = hashConfigurationRequest({ configuration: { a: 1 }, metadata: metadata("2026-01-02T00:00:00Z") });

    expect(second).toBe(first);
  });

  it("changes when the configuration changes", () => {
    const first = hashConfigurationRequest({ configuration: { a: 1 }, metadata: metadata("2026-01-01T00:00:00Z") });
    const second = hashConfigurationRequest({ configuration: { a: 2 }, metadata: metadata("2026-01-01T00:00:00Z") });

    expect(second).not.toBe(first);
  });

  it("changes when a saved value changes", () => {
    const changed = metadata("2026-01-01T00:00:00Z");
    changed.uiState = { ...changed.uiState, CabinetColor: "Other" };

    expect(hashConfigurationRequest({ configuration: {}, metadata: changed })).not.toBe(
      hashConfigurationRequest({ configuration: {}, metadata: metadata("2026-01-01T00:00:00Z") }),
    );
  });
});
