import { describe, expect, it, vi } from "vitest";

import type { RuntimeBindingSet } from "@/entities/collection";
import type { ConfigurationSceneReader, SceneLayout, SceneRestoreRequest } from "@/entities/configuration";
import type { SceneOperationResult, ScenePresetResult } from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneRestorer } from "../lib/createSceneRestorer";
import type { SceneRestoreBridge } from "../lib/createSceneRestorer";
import type { SceneLayoutImport } from "../lib/sceneLayout";

const bindings: RuntimeBindingSet = {
  schemaVersion: 1,
  collectionId: "urban-standard-height",
  productTypes: {
    "Sink-Base": "Sink-Base",
    "Sink-Cabinet": "Sink-Cabinet",
    "Side-Cabinet": "Sink-Cabinet",
  },
  bindings: [],
};

type FakeScene = SceneRestoreBridge & {
  ready: boolean;
  calls: string[];
  placed: string[];
  presetAnswer: ScenePresetResult | null;
  clearAnswer: SceneOperationResult;
  /** Order the scene reports instead of the creation order. */
  reportedOrder: string[] | null;
};

const createFakeScene = (): FakeScene => {
  const scene: FakeScene = {
    ready: true,
    calls: [],
    placed: [],
    presetAnswer: null,
    clearAnswer: { status: "applied" },
    reportedOrder: null,
    isReady: () => scene.ready,
    async clear() {
      scene.calls.push("clear");
      scene.placed = [];
      return scene.clearAnswer;
    },
    async presetProducts(products) {
      scene.calls.push(`preset:${products.map(({ name, Width }) => `${name}:${String(Width)}`).join(",")}`);
      if (scene.presetAnswer) {
        if (scene.presetAnswer.status === "applied") scene.placed = [...scene.presetAnswer.runtimeIds];
        return scene.presetAnswer;
      }

      scene.placed = products.map(({ name }, index) => `${name}-rt${index}`);
      return { status: "applied", runtimeIds: [...scene.placed] };
    },
  };

  return scene;
};

const setUp = (getBindings: () => RuntimeBindingSet | null = () => bindings) => {
  const scene = createFakeScene();
  const reader: ConfigurationSceneReader = {
    async read() {
      return { status: "ready", order: scene.reportedOrder ?? [...scene.placed], cabinets: [] };
    },
  };
  // A request without a layout never reaches this; the layout tests answer it per case.
  const importLayout = vi.fn(
    async (): Promise<SceneLayoutImport> => ({ status: "unusable", code: "PRESET_INVALID_DOCUMENT" }),
  );

  return { scene, importLayout, restorer: createSceneRestorer({ getBindings, scene, reader, importLayout }) };
};

const request = (...products: SceneRestoreRequest["products"]): SceneRestoreRequest => ({ products });

const TWO_CABINETS = request(
  { sourceId: "Sink-Base-old1", productType: "Sink-Base", config: { Width: 60, Height: 56 } },
  { sourceId: "Sink-Cabinet-old2", productType: "Side-Cabinet", config: { Width: 80, Height: 56 } },
);

describe("createSceneRestorer preflight", () => {
  it.each([
    ["an empty composition", request(), "empty-composition"],
    [
      "a repeated source id",
      request(
        { sourceId: "a", productType: "Sink-Base", config: {} },
        { sourceId: "a", productType: "Sink-Base", config: {} },
      ),
      "duplicate-source",
    ],
    ["a product without config", request({ sourceId: "a", productType: "Sink-Base", config: null }), "invalid-config"],
    [
      "a type the collection cannot place",
      request({ sourceId: "a", productType: "Vanity-X", config: {} }),
      "unknown-product-type",
    ],
  ])("rejects %s without touching the scene", async (_, input, code) => {
    const { scene, restorer } = setUp();

    const result = await restorer.restore(input);

    expect(result).toMatchObject({ status: "rejected", issues: [expect.objectContaining({ code })] });
    expect(scene.calls).toEqual([]);
  });

  it("rejects when the collection's bindings are not loaded", async () => {
    const { scene, restorer } = setUp(() => null);

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({ status: "rejected", issues: [{ code: "bindings-unavailable" }] });
    expect(scene.calls).toEqual([]);
  });

  it("does not clear a scene that is not ready", async () => {
    const { scene, restorer } = setUp();
    scene.ready = false;

    expect(await restorer.restore(TWO_CABINETS)).toEqual({ status: "not-ready" });
    expect(scene.calls).toEqual([]);
  });
});

describe("createSceneRestorer restore", () => {
  it("clears once and rebuilds with the native preset API, mapping old ids to new", async () => {
    const { scene, restorer } = setUp();

    const result = await restorer.restore(TWO_CABINETS);

    expect(scene.calls).toEqual(["clear", "preset:Sink-Base:60,Sink-Cabinet:80"]);
    expect(result).toMatchObject({
      status: "restored",
      matches: [
        { sourceId: "Sink-Base-old1", runtimeId: "Sink-Base-rt0" },
        { sourceId: "Sink-Cabinet-old2", runtimeId: "Sink-Cabinet-rt1" },
      ],
    });
  });

  it("reports every product when the preset API rejects the rebuild", async () => {
    const { scene, restorer } = setUp();
    scene.presetAnswer = { status: "failed", code: "scene-rejected", message: "no asset" };

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({
      status: "partial",
      matches: [],
      failed: [
        { sourceId: "Sink-Base-old1", code: "not-created" },
        { sourceId: "Sink-Cabinet-old2", code: "not-created" },
      ],
    });
  });

  it("reports products the preset API did not return", async () => {
    const { scene, restorer } = setUp();
    scene.presetAnswer = { status: "applied", runtimeIds: ["Sink-Base-rt0"] };

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({
      status: "partial",
      matches: [],
      failed: [
        { sourceId: "Sink-Base-old1", code: "not-created" },
        { sourceId: "Sink-Cabinet-old2", code: "not-created" },
      ],
    });
  });

  it("reports an order the scene did not keep", async () => {
    const { scene, restorer } = setUp();
    scene.reportedOrder = ["Sink-Cabinet-rt1", "Sink-Base-rt0"];

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({
      status: "partial",
      failed: [{ code: "order-mismatch" }, { code: "order-mismatch" }],
    });
  });

  it("reports every product when clearing the scene failed", async () => {
    const { scene, restorer } = setUp();
    scene.clearAnswer = { status: "failed", code: "scene-error", message: "boom" };

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({
      status: "partial",
      matches: [],
      failed: [{ code: "scene-error" }, { code: "scene-error" }],
    });
    expect(scene.calls).toEqual(["clear"]);
  });
});

describe("createSceneRestorer restore with a layout", () => {
  const LAYOUT: SceneLayout = {
    version: 1,
    document: { presetSchemaVersion: 2, collection: {}, presetProducts: [], presetLayout: {} },
    cabinetIds: { cabinet0: "Sink-Base-old1", cabinet1: "Sink-Cabinet-old2" },
  };
  const TWO_ROWS: SceneRestoreRequest = { ...TWO_CABINETS, layout: LAYOUT };
  const imported: SceneLayoutImport = {
    status: "imported",
    runtimeIds: { "Sink-Base-old1": "sink-new", "Sink-Cabinet-old2": "side-new" },
  };

  it("gives the layout to the scene instead of clearing and placing the products in one row", async () => {
    const { scene, importLayout, restorer } = setUp();
    importLayout.mockResolvedValue(imported);
    scene.reportedOrder = ["sink-new", "side-new"];

    const result = await restorer.restore(TWO_ROWS);

    expect(importLayout).toHaveBeenCalledWith(LAYOUT, ["Sink-Base-old1", "Sink-Cabinet-old2"]);
    expect(scene.calls).toEqual([]);
    expect(result).toMatchObject({
      status: "restored",
      matches: [
        { sourceId: "Sink-Base-old1", runtimeId: "sink-new" },
        { sourceId: "Sink-Cabinet-old2", runtimeId: "side-new" },
      ],
    });
  });

  it("lists the products in the scene's own order, which rows may put differently", async () => {
    const { scene, importLayout, restorer } = setUp();
    importLayout.mockResolvedValue(imported);
    scene.reportedOrder = ["side-new", "sink-new"];

    const result = await restorer.restore(TWO_ROWS);

    expect(result).toMatchObject({
      status: "restored",
      matches: [
        { sourceId: "Sink-Cabinet-old2", runtimeId: "side-new" },
        { sourceId: "Sink-Base-old1", runtimeId: "sink-new" },
      ],
    });
  });

  it("leaves the scene as it is while the scene is busy", async () => {
    const { scene, importLayout, restorer } = setUp();
    importLayout.mockResolvedValue({ status: "not-ready", code: "COMPOSITION_BUSY" });

    expect(await restorer.restore(TWO_ROWS)).toEqual({ status: "not-ready" });
    expect(scene.calls).toEqual([]);
  });

  it("rebuilds the products in one row when the scene cannot take the layout", async () => {
    const { scene, importLayout, restorer } = setUp();
    importLayout.mockResolvedValue({ status: "unusable", code: "PRESET_INVALID_DOCUMENT" });

    const result = await restorer.restore(TWO_ROWS);

    expect(scene.calls).toEqual(["clear", "preset:Sink-Base:60,Sink-Cabinet:80"]);
    expect(result).toMatchObject({ status: "restored" });
  });

  it("checks the request before the layout reaches the scene", async () => {
    const { scene, importLayout, restorer } = setUp();

    const result = await restorer.restore({ products: [], layout: LAYOUT });

    expect(result).toMatchObject({ status: "rejected", issues: [{ code: "empty-composition" }] });
    expect(importLayout).not.toHaveBeenCalled();
    expect(scene.calls).toEqual([]);
  });

  it("does not ask for a layout the request does not carry", async () => {
    const { importLayout, restorer } = setUp();

    await restorer.restore(TWO_CABINETS);

    expect(importLayout).not.toHaveBeenCalled();
  });
});
