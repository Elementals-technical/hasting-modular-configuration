// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applySceneConfig, insertSceneProduct, isSceneReady, normalizeSceneBatchResult } from "../sceneBridge";
import { setConfigBatch } from "../setConfigBatch";
import { setSteppedSceneProducts } from "../steppedSceneProducts";
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

describe("insertSceneProduct", () => {
  beforeEach(() => {
    vi.mocked(updateDimensionDataForProduct).mockClear();
  });

  afterEach(() => {
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  const installInsert = (api: (...args: never[]) => unknown) => {
    host.containerRef = { current: { contentWindow: { ConfiguratorAPI: { setConfigBatch: vi.fn(), setProductByParams: api } } } };
    host.playCanvasReady = true;
  };

  it("creates the product with its config in one call (the scene's initialConfig)", async () => {
    const api = vi.fn(async () => "rt-new");
    installInsert(api);

    expect(await insertSceneProduct("ULH-sink-cabinet", "rt-a", "left", { Width: 80 })).toEqual({
      status: "applied",
      runtimeId: "rt-new",
      configApplied: true,
    });
    expect(api).toHaveBeenCalledWith("ULH-sink-cabinet", "rt-a", "left", { Width: 80 });
    expect(updateDimensionDataForProduct).toHaveBeenCalledWith("rt-new", { Width: 80 });
  });

  it("without a config, places the product with the scene defaults", async () => {
    const api = vi.fn(async () => "rt-new");
    installInsert(api);

    expect(await insertSceneProduct("Sink-Base", null, "right")).toEqual({ status: "applied", runtimeId: "rt-new" });
    expect(api).toHaveBeenCalledWith("Sink-Base", null, "right");
  });

  it("keeps the scene's refusal code (UF height run), so the interface can explain it", async () => {
    const refusal = Object.assign(new Error("A short cabinet cannot stand between tall ones"), {
      code: "UF_HEIGHT_RUN_VIOLATION",
      operation: "insert",
      draftClass: "short",
      insertIndex: 1,
    });
    installInsert(vi.fn(async () => Promise.reject(refusal)));

    expect(await insertSceneProduct("UF-side-cabinet", "rt-a", "right", { Height: 56, Handle: "UG" })).toEqual({
      status: "failed",
      code: "scene-error",
      message: "A short cabinet cannot stand between tall ones",
      sceneCode: "UF_HEIGHT_RUN_VIOLATION",
    });
  });

  it("reports an error without a code as a plain scene error", async () => {
    installInsert(vi.fn(async () => Promise.reject(new Error("boom"))));

    expect(await insertSceneProduct("Sink-Base", "rt-a", "left")).toEqual({
      status: "failed",
      code: "scene-error",
      message: "boom",
    });
  });
});

describe("stepped products through the bridge", () => {
  const stepped = [{ productType: "UF-side-cabinet", match: { Drawers: "1D" }, heightByHandle: { PTO: 50, UG: 53 } }];

  afterEach(() => {
    setSteppedSceneProducts(null);
    delete host.containerRef;
    delete host.playCanvasReady;
  });

  it("gives a short cabinet its own height back after the composition's height reached every product", async () => {
    setSteppedSceneProducts(stepped);
    const configs: Record<string, Record<string, unknown>> = {
      short: { productType: "UF-side-cabinet", Drawers: "1D", Handle: "UG", Height: 53 },
      tall: { productType: "UF-side-cabinet", Drawers: "2D", Handle: "UG", Height: 91 },
    };
    const setConfigBatchApi = vi.fn(async (_selector: unknown, patch: Record<string, unknown>) => {
      Object.values(configs).forEach((config) => Object.assign(config, patch));
      return { updatedIds: Object.keys(configs) };
    });
    const setConfig = vi.fn(async (id: string, patch: Record<string, unknown>) => Object.assign(configs[id], patch));
    host.containerRef = {
      current: {
        contentWindow: {
          ConfiguratorAPI: {
            setConfigBatch: setConfigBatchApi,
            getConfig: async (id: string) => configs[id],
            setConfig,
          },
        },
      },
    };
    host.playCanvasReady = true;

    expect(await applySceneConfig({}, { Handle: "PTO" })).toMatchObject({ status: "applied" });
    expect(await applySceneConfig({}, { Height: 88 })).toMatchObject({ status: "applied" });

    expect(configs.short).toMatchObject({ Handle: "PTO", Height: 50 });
    expect(configs.tall).toMatchObject({ Handle: "PTO", Height: 88 });
    expect(setConfig).toHaveBeenCalledWith("short", { Height: 50 });
  });
});
