import { describe, expect, it } from "vitest";

import type { RuntimeBindingSet } from "@/entities/collection";
import type { ConfigurationSceneReader, SceneRestoreRequest } from "@/entities/configuration";
import type { SceneAddProductResult, SceneOperationResult } from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneRestorer } from "../lib/createSceneRestorer";
import type { SceneRestoreBridge } from "../lib/createSceneRestorer";

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
  /** Answers of addProduct by call index; unlisted calls create the product. */
  addAnswers: Map<number, SceneAddProductResult>;
  configAnswers: Map<string, SceneOperationResult>;
  clearAnswer: SceneOperationResult;
  /** Order the scene reports instead of the creation order. */
  reportedOrder: string[] | null;
};

const createFakeScene = (): FakeScene => {
  let addCount = 0;

  const scene: FakeScene = {
    ready: true,
    calls: [],
    placed: [],
    addAnswers: new Map(),
    configAnswers: new Map(),
    clearAnswer: { status: "applied" },
    reportedOrder: null,
    isReady: () => scene.ready,
    async clear() {
      scene.calls.push("clear");
      scene.placed = [];
      return scene.clearAnswer;
    },
    async addProduct(productType, config) {
      const index = addCount;
      addCount += 1;
      scene.calls.push(`add:${productType}:${String(config.Width)}`);

      const answer = scene.addAnswers.get(index);
      if (answer) return answer;

      const runtimeId = `${productType}-rt${index}`;
      scene.placed.push(runtimeId);
      return { status: "applied", runtimeId };
    },
    async setConfig(runtimeId, config) {
      scene.calls.push(`config:${runtimeId}:${String(config.Width)}`);
      return scene.configAnswers.get(runtimeId) ?? { status: "applied" };
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

  return { scene, restorer: createSceneRestorer({ getBindings, scene, reader }) };
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
  it("clears once and rebuilds in order, each cabinet with its own config, mapping old ids to new", async () => {
    const { scene, restorer } = setUp();

    const result = await restorer.restore(TWO_CABINETS);

    expect(scene.calls).toEqual([
      "clear",
      "add:Sink-Base:60",
      "config:Sink-Base-rt0:60",
      "add:Sink-Cabinet:80",
      "config:Sink-Cabinet-rt1:80",
    ]);
    expect(result).toMatchObject({
      status: "restored",
      matches: [
        { sourceId: "Sink-Base-old1", runtimeId: "Sink-Base-rt0" },
        { sourceId: "Sink-Cabinet-old2", runtimeId: "Sink-Cabinet-rt1" },
      ],
    });
  });

  it("keeps rebuilding after a product the scene did not create and reports it", async () => {
    const { scene, restorer } = setUp();
    scene.addAnswers.set(0, { status: "failed", code: "scene-rejected", message: "no asset" });

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({
      status: "partial",
      matches: [{ sourceId: "Sink-Cabinet-old2", runtimeId: "Sink-Cabinet-rt1" }],
      failed: [{ sourceId: "Sink-Base-old1", code: "not-created" }],
    });
  });

  it("reports a config the scene refused", async () => {
    const { scene, restorer } = setUp();
    scene.configAnswers.set("Sink-Cabinet-rt1", { status: "failed", code: "product-not-found", message: "gone" });

    const result = await restorer.restore(TWO_CABINETS);

    expect(result).toMatchObject({
      status: "partial",
      failed: [{ sourceId: "Sink-Cabinet-old2", code: "config-rejected" }],
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
