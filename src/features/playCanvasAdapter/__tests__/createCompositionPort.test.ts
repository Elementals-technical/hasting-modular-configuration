import { describe, expect, it } from "vitest";

import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { RuntimeBindingSet } from "@/entities/collection";
import type {
  SceneAddProductResult,
  SceneOperationResult,
  ScenePresetResult,
} from "@/utils/functions/playcanvas/sceneBridge";

import { createCompositionPort, type SceneCompositionBridge } from "../lib/createCompositionPort";
import { createTestSceneReader } from "../lib/testSceneReader";

type Answers = {
  preset?: ScenePresetResult;
  add?: SceneAddProductResult;
  insert?: SceneAddProductResult;
  setConfig?: SceneOperationResult;
  remove?: SceneOperationResult[];
};

const createFakeScene = (answers: Answers = {}) => {
  const calls: unknown[][] = [];
  const removeAnswers = [...(answers.remove ?? [])];
  let ready = true;

  const scene: SceneCompositionBridge = {
    isReady: () => ready,
    async clear() {
      calls.push(["clear"]);
      return { status: "applied" };
    },
    async presetProducts(products, globalConfig) {
      calls.push(["preset", products, globalConfig]);
      return answers.preset ?? { status: "applied", runtimeIds: products.map(({ name }, index) => `${name}-${index}`) };
    },
    async addProduct(productType, config) {
      calls.push(["add", productType, config]);
      return answers.add ?? { status: "applied", runtimeId: `${productType}-added` };
    },
    async insertProduct(productType, anchorRuntimeId, side) {
      calls.push(["insert", productType, anchorRuntimeId, side]);
      return answers.insert ?? { status: "applied", runtimeId: `${productType}-inserted` };
    },
    async setProductConfig(runtimeId, config) {
      calls.push(["setConfig", runtimeId, config]);
      return answers.setConfig ?? { status: "applied" };
    },
    async removeProduct(runtimeId) {
      calls.push(["remove", runtimeId]);
      return removeAnswers.shift() ?? { status: "applied" };
    },
    async swapProducts(runtimeIdA, runtimeIdB) {
      calls.push(["swap", runtimeIdA, runtimeIdB]);
      return { status: "applied" };
    },
  };

  return {
    scene,
    calls,
    setReady: (value: boolean) => {
      ready = value;
    },
  };
};

const createPort = (answers?: Answers, bindings: RuntimeBindingSet = ushRuntimeBindings) => {
  const fake = createFakeScene(answers);
  const reader = createTestSceneReader();
  const port = createCompositionPort({
    getBindings: () => bindings,
    scene: fake.scene,
    reader: reader.reader,
  });
  return { ...fake, reader, port };
};

describe("createCompositionPort", () => {
  it("places a preset in one call, each product named by its scene type, the shared values translated", async () => {
    const { port, calls } = createPort();

    const result = await port.replace({
      products: [
        { productType: "Side-Cabinet", config: { Width: 40 } },
        { productType: "Sink-Base", config: { Width: 60 } },
      ],
      shared: { CountertopStyle: "vessel", CountertopColor: "Bianco Gloss TAN" },
      flow: "prebuilt",
    });

    expect(result).toMatchObject({ status: "applied", placed: ["Sink-Cabinet-0", "Sink-Base-1"] });
    expect(calls).toEqual([
      [
        "preset",
        [
          { Width: 40, ProductType: "Sink-Cabinet", productType: "Sink-Cabinet", name: "Sink-Cabinet" },
          { Width: 60, ProductType: "Sink-Base", productType: "Sink-Base", name: "Sink-Base" },
        ],
        { CountertopStyle: "Vessel", CountertopColor: "Bianco Gloss TAL" },
      ],
    ]);
  });

  it("refuses a product type or a shared value the collection cannot place, before any call", async () => {
    const { port, calls } = createPort();

    const result = await port.replace({
      products: [{ productType: "Tower", config: {} }],
      shared: { TowelBarOption: "Sideways" },
      flow: "prebuilt",
    });

    expect(result).toMatchObject({ status: "rejected" });
    expect(result.status === "rejected" && result.issues.map(({ code }) => code)).toEqual([
      "unknown-product-type",
      "unknown-value",
    ]);
    expect(calls).toEqual([]);
  });

  it("takes the placed ids from the scene's order when the preset call does not name them", async () => {
    const { port, reader } = createPort({ preset: { status: "applied", runtimeIds: [] } });
    reader.setScene(["sb-1", "sc-2"], {});

    const result = await port.replace({
      products: [
        { productType: "Sink-Base", config: {} },
        { productType: "Sink-Cabinet", config: {} },
      ],
      flow: "prebuilt",
    });

    expect(result).toMatchObject({ status: "applied", placed: ["sb-1", "sc-2"] });
  });

  it("reports a failed preset as partial: the scene clears the composition first", async () => {
    const { port } = createPort({ preset: { status: "failed", code: "scene-error", message: "boom" } });

    const result = await port.replace({ products: [{ productType: "Sink-Base", config: {} }], flow: "prebuilt" });

    expect(result).toMatchObject({ status: "partial", placed: [], message: "boom" });
  });

  it("places a cabinet beside another, then gives it its own config", async () => {
    const { port, calls } = createPort();

    const result = await port.add(
      { productType: "Sink-Base", config: { Width: 60 } },
      { kind: "beside", anchorRuntimeId: "cab-a", side: "left" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["Sink-Base-inserted"] });
    expect(calls).toEqual([
      ["insert", "Sink-Base", "cab-a", "left"],
      ["setConfig", "Sink-Base-inserted", { Width: 60, ProductType: "Sink-Base", productType: "Sink-Base" }],
    ]);
  });

  it("places a Mako cabinet as the Mako scene product, with the keys the Mako scene reads", async () => {
    const { port, calls } = createPort(undefined, makoRuntimeBindings);

    await port.add(
      {
        productType: "Sink-Base",
        config: { Width: 80, Height: 56, Depth: 52, Handle: "G50", Drawers: "2", sinkType: "LB440" },
      },
      { kind: "end" },
    );

    expect(calls).toEqual([
      [
        "add",
        "Mako-sink-cabinet",
        {
          Width: 80,
          Height: 52,
          Depth: 52,
          HandleStyle: "G50",
          Drawers: "2D",
          ShowLegs: "Disable",
          ProductType: "Mako-sink-cabinet",
          productType: "Mako-sink-cabinet",
        },
      ],
    ]);
  });

  it("places a Mako cabinet beside another as the Mako scene product (the builder's plus button)", async () => {
    const { port, calls } = createPort(undefined, makoRuntimeBindings);

    const result = await port.add(
      { productType: "Sink-Cabinet", config: { Width: 40, Height: 56, Depth: 52, Handle: "G57", Drawers: "1" } },
      { kind: "beside", anchorRuntimeId: "cab-a", side: "right" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["Mako-side-cabinet-inserted"] });
    expect(calls).toEqual([
      ["insert", "Mako-side-cabinet", "cab-a", "right"],
      [
        "setConfig",
        "Mako-side-cabinet-inserted",
        {
          Width: 40,
          Height: 26,
          Depth: 52,
          HandleStyle: "G57",
          Drawers: "1D",
          ShowLegs: "Disable",
          ProductType: "Mako-side-cabinet",
          productType: "Mako-side-cabinet",
        },
      ],
    ]);
  });

  it("places a Mako preset, a side cabinet on legs in the cabinet colour", async () => {
    const { port, calls } = createPort(undefined, makoRuntimeBindings);

    await port.replace({
      products: [{ productType: "Sink-Cabinet", config: { Width: 40, Drawers: "2", LegColor: "None" } }],
      flow: "prebuilt",
    });

    expect(calls).toEqual([
      [
        "preset",
        [
          {
            Width: 40,
            Drawers: "2D",
            Height: 52,
            ShowLegs: "Enable",
            LegColor: "None",
            ProductType: "Mako-side-cabinet",
            productType: "Mako-side-cabinet",
            name: "Mako-side-cabinet",
          },
        ],
        undefined,
      ],
    ]);
  });

  it("reports a cabinet placed without its config as partial", async () => {
    const { port } = createPort({ setConfig: { status: "failed", code: "product-not-found", message: "gone" } });

    const result = await port.add(
      { productType: "Sink-Base", config: {} },
      { kind: "beside", anchorRuntimeId: "cab-a", side: "right" },
    );

    expect(result).toMatchObject({ status: "partial", placed: ["Sink-Base-inserted"], message: "gone" });
  });

  it("places a cabinet after the last one with its config in the same call", async () => {
    const { port, calls } = createPort();

    await port.add({ productType: "Side-Shelf", config: { Width: 20 } }, { kind: "end" });

    expect(calls).toEqual([["add", "Side-Shelf", { Width: 20, ProductType: "Side-Shelf", productType: "Side-Shelf" }]]);
  });

  it("stops removing at the first product the scene keeps", async () => {
    const failed: SceneOperationResult = { status: "failed", code: "product-not-found", message: "no b" };

    const first = createPort({ remove: [failed] });
    expect(await first.port.remove(["cab-a", "cab-b"])).toMatchObject({ status: "failed" });
    expect(first.calls).toEqual([["remove", "cab-a"]]);

    const second = createPort({ remove: [{ status: "applied" }, failed] });
    expect(await second.port.remove(["cab-a", "cab-b"])).toMatchObject({ status: "partial" });
  });

  it("sends nothing while the scene is not ready", async () => {
    const { port, calls, setReady } = createPort();
    setReady(false);

    expect(await port.replace({ products: [{ productType: "Sink-Base", config: {} }], flow: "prebuilt" })).toEqual({
      status: "not-ready",
    });
    expect(await port.clear()).toEqual({ status: "not-ready" });
    expect(await port.swap("a", "b")).toEqual({ status: "not-ready" });
    expect(calls).toEqual([]);
  });
});
