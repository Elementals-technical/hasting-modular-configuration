// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applySceneConfig, isSceneReady, normalizeSceneBatchResult } from "../sceneBridge";
import { setConfigBatch } from "../setConfigBatch";
import { updateDimensionDataForProduct } from "../updateDimensionData";

vi.mock("../apiLogger", () => ({ installConfiguratorApiLogger: vi.fn() }));
vi.mock("../updateDimensionData", () => ({ updateDimensionDataForProduct: vi.fn() }));

type Host = { containerRef?: unknown; playCanvasReady?: boolean };

const host = window as unknown as Host;

const installScene = (setConfigBatchApi: (...args: never[]) => unknown, ready = true) => {
  host.containerRef = { current: { contentWindow: { ConfiguratorAPI: { setConfigBatch: setConfigBatchApi } } } };
  host.playCanvasReady = ready;
};

describe("normalizeSceneBatchResult", () => {
  it("reads each answer of ConfiguratorAPI.setConfigBatch as one status", () => {
    expect(normalizeSceneBatchResult([], {})).toEqual({ status: "not-ready" });
    expect(normalizeSceneBatchResult(true, {})).toEqual({ status: "applied", updatedIds: null });
    expect(normalizeSceneBatchResult({ updatedIds: ["a", "b"], dividerConflicts: [] }, {})).toEqual({
      status: "applied",
      updatedIds: ["a", "b"],
    });
    expect(normalizeSceneBatchResult(false, {})).toMatchObject({ status: "failed", code: "scene-rejected" });
    expect(normalizeSceneBatchResult(undefined, {})).toMatchObject({ status: "failed", code: "scene-rejected" });
  });

  it("fails when an addressed product was not updated", () => {
    expect(normalizeSceneBatchResult({ updatedIds: ["a"] }, { productIds: ["a", "missing"] })).toMatchObject({
      status: "failed",
      code: "product-not-found",
      message: expect.stringContaining("missing"),
    });
  });
});

describe("applySceneConfig", () => {
  beforeEach(() => {
    vi.mocked(updateDimensionDataForProduct).mockClear();
  });

  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  it("tells a scene that is not ready from a failed call", async () => {
    expect(isSceneReady()).toBe(false);
    expect(await applySceneConfig({}, { Height: 56 })).toEqual({ status: "not-ready" });

    installScene(vi.fn(), false);
    expect(isSceneReady()).toBe(false);
    expect(await applySceneConfig({}, { Height: 56 })).toEqual({ status: "not-ready" });
  });

  it("sends the patch and refreshes dimension labels of the updated products", async () => {
    const api = vi.fn(async () => ({ updatedIds: ["rt-1"], dividerConflicts: [] }));
    installScene(api);

    expect(isSceneReady()).toBe(true);
    expect(await applySceneConfig({ productIds: ["rt-1"] }, { Width: 60 })).toEqual({
      status: "applied",
      updatedIds: ["rt-1"],
    });
    expect(api).toHaveBeenCalledWith({ productIds: ["rt-1"] }, { Width: 60 });
    expect(updateDimensionDataForProduct).toHaveBeenCalledWith("rt-1", { Width: 60 });
  });

  it("turns a thrown error into a failure instead of swallowing it", async () => {
    installScene(
      vi.fn(async () => {
        throw new Error("composition locked");
      }),
    );

    expect(await applySceneConfig({}, { Height: 56 })).toEqual({
      status: "failed",
      code: "scene-error",
      message: "composition locked",
    });
  });

  it("shares the queue with the legacy setConfigBatch, so neither overtakes the other", async () => {
    const order: string[] = [];
    let releaseLegacy: () => void = () => undefined;

    installScene(async (_selector: unknown, patch: Record<string, unknown>) => {
      const key = Object.keys(patch)[0];
      order.push(`start ${key}`);
      if (key === "Handle") await new Promise<void>((resolve) => (releaseLegacy = resolve));
      order.push(`end ${key}`);
      return { updatedIds: [] };
    });

    const legacy = setConfigBatch({}, { Handle: "handle_pto" });
    const adapter = applySceneConfig({}, { Height: 50 });

    await vi.waitFor(() => expect(order).toEqual(["start Handle"]));
    releaseLegacy();
    await Promise.all([legacy, adapter]);

    expect(order).toEqual(["start Handle", "end Handle", "start Height", "end Height"]);
  });
});
