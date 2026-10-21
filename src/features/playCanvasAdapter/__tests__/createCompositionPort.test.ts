import { describe, expect, it, vi } from "vitest";

import urbanDuplexBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";
import { parseRuntimeBindings } from "@/entities/collection";
import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ulhRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { RuntimeBindingSet } from "@/entities/collection";
import type {
  SceneAddProductResult,
  SceneOperationResult,
  ScenePresetResult,
} from "@/utils/functions/playcanvas/sceneBridge";

import { createCompositionPort, type SceneCompositionBridge } from "../lib/createCompositionPort";
import type { SceneSlotRequest } from "../lib/sceneSlotPlacement";
import { createTestSceneReader } from "../lib/testSceneReader";

// As the scene's placement does: each of its calls waits in the batch queue of the bridge.
vi.mock("../lib/sceneSlotPlacement", async () => {
  const { runInBatchQueue } = await import("@/utils/functions/playcanvas/setConfigBatch");
  return {
    placeInSceneSlot: async () =>
      runInBatchQueue(async () => ({ status: "applied", runtimeId: "UD-side-cabinet-queued" })),
  };
});

type Answers = {
  preset?: ScenePresetResult;
  add?: SceneAddProductResult;
  insert?: SceneAddProductResult;
  setConfig?: SceneOperationResult;
  remove?: SceneOperationResult[];
  swap?: SceneOperationResult;
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
    async insertProduct(productType, anchorRuntimeId, side, config) {
      calls.push(["insert", productType, anchorRuntimeId, side, config]);
      return answers.insert ?? { status: "applied", runtimeId: `${productType}-inserted`, configApplied: true };
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
      return answers.swap ?? { status: "applied" };
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

const parsedUrbanDuplexBindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsedUrbanDuplexBindings.ok) throw new Error("the packaged Urban Duplex bindings must parse");
const urbanDuplexRuntimeBindings = parsedUrbanDuplexBindings.bindings;

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

  it("places a cabinet beside another with its own config in one call (no follow-up width change)", async () => {
    const { port, calls } = createPort();

    const result = await port.add(
      { productType: "Sink-Base", config: { Width: 60 } },
      { kind: "beside", anchorRuntimeId: "cab-a", side: "left" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["Sink-Base-inserted"] });
    expect(calls).toEqual([
      ["insert", "Sink-Base", "cab-a", "left", { Width: 60, ProductType: "Sink-Base", productType: "Sink-Base" }],
    ]);
  });

  it("places the first cabinet of an empty composition beside no product, as the scene's + of an empty scene", async () => {
    const { port, calls } = createPort();

    const result = await port.add(
      { productType: "Sink-Base", config: { Width: 60 } },
      { kind: "beside", anchorRuntimeId: null, side: "right" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["Sink-Base-inserted"] });
    expect(calls).toEqual([
      ["insert", "Sink-Base", null, "right", { Width: 60, ProductType: "Sink-Base", productType: "Sink-Base" }],
    ]);
  });

  it("falls back to a follow-up config when the scene placed the cabinet with its defaults", async () => {
    const { port, calls } = createPort({ insert: { status: "applied", runtimeId: "Sink-Base-inserted" } });

    const result = await port.add(
      { productType: "Sink-Base", config: { Width: 60 } },
      { kind: "beside", anchorRuntimeId: "cab-a", side: "left" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["Sink-Base-inserted"] });
    expect(calls).toEqual([
      ["insert", "Sink-Base", "cab-a", "left", { Width: 60, ProductType: "Sink-Base", productType: "Sink-Base" }],
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
          sinkType: "Top_HPLPrisma",
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
      [
        "insert",
        "Mako-side-cabinet",
        "cab-a",
        "right",
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

  it("places an Urban Low Height cabinet beside another as the ULH scene product, with its basin", async () => {
    const { port, calls } = createPort(undefined, ulhRuntimeBindings);

    const result = await port.add(
      {
        productType: "Sink-Base",
        config: {
          Width: 80,
          Height: 35,
          Depth: 46,
          Handle: "handle_pto",
          Drawers: "1",
          sinkType: "Top_HPLPrisma",
          HandleGrooveColor: "Black",
        },
      },
      { kind: "beside", anchorRuntimeId: "cab-a", side: "left" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["ULH-sink-cabinet-inserted"] });
    expect(calls).toEqual([
      [
        "insert",
        "ULH-sink-cabinet",
        "cab-a",
        "left",
        {
          Width: 80,
          Height: 35,
          Depth: 46,
          Handle: "handle_pto",
          Drawers: "1D",
          sinkType: "Top_HPLPrisma",
          HandleGrooveColor: "Black",
          ProductType: "ULH-sink-cabinet",
          productType: "ULH-sink-cabinet",
        },
      ],
    ]);
  });

  it("does not place the Urban Low Height Open Side Shelf, which has no scene product yet", async () => {
    const { port, calls } = createPort(undefined, ulhRuntimeBindings);

    const result = await port.add({ productType: "Open-Side-Shelf", config: { Width: 15 } }, { kind: "end" });

    expect(result).toMatchObject({ status: "rejected", issues: [{ code: "unknown-product-type" }] });
    expect(calls).toEqual([]);
  });

  it("places a Mako preset, a side cabinet on legs in the leg colour it names", async () => {
    const { port, calls } = createPort(undefined, makoRuntimeBindings);

    await port.replace({
      products: [{ productType: "Sink-Cabinet", config: { Width: 40, Drawers: "2", LegColor: "Antracite 400 MT" } }],
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
            // The scene material of the legs, so they do not take the cabinet's.
            LegColor: "Antracite 400 Lacquered MT",
            ProductType: "Mako-side-cabinet",
            productType: "Mako-side-cabinet",
            name: "Mako-side-cabinet",
          },
        ],
        undefined,
      ],
    ]);
  });

  it("places an Urban Duplex model with its shelves, each product in the colours of its own type", async () => {
    const { port, calls } = createPort(undefined, urbanDuplexRuntimeBindings);
    const colours = { BasePanelColor: "Bianco Calce DA ST", LateralPanelColor: "Pulpis Chiaro TKH" };

    const result = await port.replace({
      products: [
        { productType: "Side-Shelf", config: { Width: 15, Height: 56, OpenSideShelfSide: "L", ...colours } },
        {
          productType: "Sink-Base",
          config: {
            Width: 70,
            Height: 56,
            Drawers: "2",
            Handle: "UG",
            Series: "URDPX",
            LateralPanelSide: "L",
            ...colours,
          },
        },
        { productType: "Open-Shelf", config: { Width: 35, Height: 56, ...colours } },
        {
          productType: "Sink-Cabinet",
          config: { Width: 80, Height: 56, Drawers: "2", Handle: "UG", Series: "URSTD", ...colours },
        },
      ],
      flow: "prebuilt",
    });

    expect(result).toMatchObject({ status: "applied" });
    const [, products] = calls[0] as [string, Record<string, unknown>[]];
    expect(products.map(({ name }) => name)).toEqual([
      "UD-open-shelves-side",
      "UD-sink-cabinet",
      "UD-open-shelves",
      "UD-side-cabinet",
    ]);
    // The open side shelf is the lateral panel colour, the open shelf the base panel colour.
    expect(products[0]).toMatchObject({ CabinetColor: "Pulpis Chiaro TKH" });
    expect(products[2]).toMatchObject({ CabinetColor: "Bianco Calce DA ST" });
    // A drawer cabinet: body, lateral part and grooves, its lateral panel on its own side.
    expect(products[1]).toMatchObject({
      CabinetColor: "Bianco Calce DA ST",
      CabinetColorLateral: "Pulpis Chiaro TKH",
      HandleGrooveColor: "Pulpis Chiaro TKH",
      HandleStyle: "Duplex",
      HandleSide: "Left",
      Drawers: "2D",
    });
    // A cabinet of another Urban series has no lateral panel: the full handles.
    expect(products[3]).toMatchObject({ CabinetColor: "Bianco Calce DA ST", HandleStyle: "Default" });
    // The attributes themselves are not scene keys.
    for (const product of products) {
      expect(product).not.toHaveProperty("BasePanelColor");
      expect(product).not.toHaveProperty("LateralPanelColor");
      expect(product).not.toHaveProperty("Series");
    }
  });

  it("places an Urban Duplex cabinet at a place the scene offers, translated for its scene type", async () => {
    const fake = createFakeScene();
    const requests: SceneSlotRequest[] = [];
    const port = createCompositionPort({
      getBindings: () => urbanDuplexRuntimeBindings,
      scene: fake.scene,
      reader: createTestSceneReader().reader,
      placeInSlot: async (request) => {
        requests.push(request);
        return { status: "applied", runtimeId: "UD-side-cabinet-placed" };
      },
    });

    const result = await port.add(
      {
        productType: "Sink-Cabinet",
        config: { Width: 70, Height: 28, Drawers: "1", Series: "URSTD", LateralPanelSide: "L" },
      },
      { kind: "slot", anchorRuntimeId: "UD-sink-cabinet-1", slot: "bottom" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["UD-side-cabinet-placed"] });
    // Neither an insert nor an add: the scene's own placement does it.
    expect(fake.calls).toEqual([]);
    expect(requests).toEqual([
      {
        sceneType: "UD-side-cabinet",
        anchorRuntimeId: "UD-sink-cabinet-1",
        slot: "bottom",
        config: expect.objectContaining({
          Width: 70,
          Drawers: "1D",
          HandleStyle: "Default",
          HandleSide: "Left",
          ProductType: "UD-side-cabinet",
        }),
      },
    ]);
  });

  it("passes a place the scene refuses through as rejected", async () => {
    const issue = { code: "placement-unavailable" as const, message: "DOES_NOT_FIT" };
    const port = createCompositionPort({
      getBindings: () => urbanDuplexRuntimeBindings,
      scene: createFakeScene().scene,
      reader: createTestSceneReader().reader,
      placeInSlot: async () => ({ status: "rejected", issues: [issue] }),
    });

    const result = await port.add(
      { productType: "Sink-Cabinet", config: { Width: 60, Height: 56 } },
      { kind: "slot", anchorRuntimeId: "UD-side-cabinet-1", slot: "top" },
    );

    expect(result).toEqual({ status: "rejected", issues: [issue] });
  });

  it("leaves the batch queue free for the calls of its own placement", async () => {
    const port = createCompositionPort({
      getBindings: () => urbanDuplexRuntimeBindings,
      scene: createFakeScene().scene,
      reader: createTestSceneReader().reader,
    });

    const result = await port.add(
      { productType: "Sink-Cabinet", config: { Width: 70, Height: 28 } },
      { kind: "slot", anchorRuntimeId: "UD-sink-cabinet-1", slot: "right" },
    );

    expect(result).toMatchObject({ status: "applied", placed: ["UD-side-cabinet-queued"] });
  });

  it("translates a product for the scene's own tools without a scene call", () => {
    const { port, calls } = createPort(undefined, urbanDuplexRuntimeBindings);

    const draft = port.toSceneProduct({
      productType: "Side-Shelf",
      config: { Width: 15, BasePanelColor: "Bianco Calce DA ST", LateralPanelColor: "Pulpis Chiaro TKH" },
    });

    // The open side shelf is the lateral panel colour, as when it is placed.
    expect(draft).toMatchObject({ sceneType: "UD-open-shelves-side", config: { CabinetColor: "Pulpis Chiaro TKH" } });
    expect(calls).toEqual([]);
    expect(port.toSceneProduct({ productType: "Unknown-Type", config: {} })).toBeNull();
  });

  it("sends a shared value under its other keys too, but not the one meant for a single product type", async () => {
    const { port, calls } = createPort(undefined, urbanDuplexRuntimeBindings);

    await port.replace({
      products: [{ productType: "Sink-Base", config: { Width: 60 } }],
      shared: { LateralPanelColor: "Metal bronzo 2MD" },
      flow: "prebuilt",
    });

    expect(calls[0]?.[2]).toEqual({ CabinetColorLateral: "Metal bronzo 2MD", HandleGrooveColor: "Metal bronzo 2MD" });
  });

  it("reports a cabinet placed without its config as partial", async () => {
    const { port } = createPort({
      insert: { status: "applied", runtimeId: "Sink-Base-inserted" },
      setConfig: { status: "failed", code: "product-not-found", message: "gone" },
    });

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

  it("keeps the scene's refusal code of an insert or a swap (UF height run)", async () => {
    const refusal: SceneOperationResult = {
      status: "failed",
      code: "scene-error",
      message: "short between tall",
      sceneCode: "UF_HEIGHT_RUN_VIOLATION",
    };

    const inserting = createPort({ insert: refusal });
    expect(
      await inserting.port.add(
        { productType: "Side-Cabinet", config: { Width: 40 } },
        { kind: "beside", anchorRuntimeId: "cab-a", side: "right" },
      ),
    ).toEqual({ status: "failed", message: "short between tall", sceneCode: "UF_HEIGHT_RUN_VIOLATION" });

    const swapping = createPort({ swap: refusal });
    expect(await swapping.port.swap("cab-a", "cab-b")).toEqual({
      status: "failed",
      message: "short between tall",
      sceneCode: "UF_HEIGHT_RUN_VIOLATION",
    });
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
