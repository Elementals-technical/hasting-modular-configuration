import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/app/store";
import {
  tricotConfigurator,
  tricotProfile,
  tricotRuntimeBindings as bindings,
} from "@/entities/collection/__tests__/tricotFixtures";
import {
  getCabinetEntries,
  getAttributeValue,
  resetConfiguration,
  setActiveCollectionId,
  setActiveRuntimeBindings,
  setAttributeValue,
  syncCabinets,
} from "@/entities/configuration";
import {
  reset,
  setActiveProfile,
  setCabinetCatalog,
  setCabinetColorMaterial,
} from "@/entities/product/model/store/slice";
import { buildCabinetCatalogFromProfile } from "@/entities/product/lib/matrixCabinet";
import presets from "../../../../public/collections/tricot/presets.json";
import { changeAttribute } from "@/features/configurationCommands/lib/changeAttribute";
import { createCompositionPort, type SceneCompositionBridge } from "../lib/createCompositionPort";
import { createSceneRestorer } from "../lib/createSceneRestorer";
import { createPlayCanvasRuntimePort, type SceneBridge } from "../lib/createPlayCanvasRuntimePort";
import { createTestSceneReader } from "../lib/testSceneReader";

const approvedConfig = {
  Width: 80,
  Height: 40,
  Depth: 52,
  Drawers: "1+inner",
  CabinetColor: "Zafferano 412 MT",
  HandleGrooveColor: "Nero 433 MT",
  DrawerPanelFluting: "Loden",
};
// Pending choices a placed cabinet must not send, and the semantic pattern, sent as CabinetPattern.
const NOT_SENT = ["CabinetColor", "SidePanels", "DrawerPanelFluting"];
// The basin, as Class sends it: the authored sub-product of its LB/VA/LV name, on the sink base only.
const expectBasinOnSinkBaseOnly = (product: Record<string, unknown>) =>
  product.name === "Tricot-sink-cabinet" || product.productType === "Tricot-sink-cabinet"
    ? expect(product).toMatchObject({ sinkType: "Top_HPLPrisma" })
    : expect(product).not.toHaveProperty("sinkType");
const fakeScene = () =>
  ({
    isReady: () => true,
    clear: vi.fn(async () => ({ status: "applied" as const })),
    // One runtime id per product, in order, so a recipe of several cabinets is placed whole.
    presetProducts: vi.fn<SceneCompositionBridge["presetProducts"]>(async (products) => ({
      status: "applied",
      runtimeIds: products.map(({ name }, index) => `${name}-r${index + 1}`),
    })),
    addProduct: vi.fn<SceneCompositionBridge["addProduct"]>(async () => ({
      status: "applied",
      runtimeId: "Tricot-side-cabinet-r2",
    })),
    insertProduct: vi.fn<SceneCompositionBridge["insertProduct"]>(async () => ({
      status: "applied",
      runtimeId: "Tricot-side-cabinet-r3",
      configApplied: true,
    })),
    setProductConfig: vi.fn(async () => ({ status: "applied" as const })),
    removeProduct: vi.fn(async () => ({ status: "applied" as const })),
    swapProducts: vi.fn(async () => ({ status: "applied" as const })),
  }) satisfies SceneCompositionBridge;

describe("Tricot production composition handoff through the adapter", () => {
  it("places approved cabinet fields, preserving the returned instance ID for later removal", async () => {
    const scene = fakeScene();
    const port = createCompositionPort({ getBindings: () => bindings, scene, reader: createTestSceneReader().reader });
    const result = await port.add({ productType: "Side-Cabinet", config: approvedConfig }, { kind: "end" });
    expect(result).toMatchObject({ status: "applied", placed: ["Tricot-side-cabinet-r2"] });
    expect(scene.addProduct).toHaveBeenCalledWith(
      "Tricot-side-cabinet",
      expect.objectContaining({
        Width: 80,
        Height: 40,
        Depth: 52,
        Drawers: "1DWID",
        CabinetColor: "Zafferano 412 Lacquered MT",
        HandleGrooveColor: "Nero 433 Lacquered MT",
        CabinetPattern: "Loden",
      }),
    );
    expect(scene.addProduct).toHaveBeenCalledWith(
      "Tricot-side-cabinet",
      expect.not.objectContaining({ DrawerPanelFluting: expect.anything() }),
    );
    await port.remove(["Tricot-side-cabinet-r2"]);
    expect(scene.removeProduct).toHaveBeenCalledWith("Tricot-side-cabinet-r2");
  });

  it.each(["prebuilt", "custom"] as const)(
    "places approved fields and translates shared materials in %s",
    async (flow) => {
      const scene = fakeScene();
      const port = createCompositionPort({
        getBindings: () => bindings,
        scene,
        reader: createTestSceneReader().reader,
      });
      expect(
        await port.replace({
          products: [{ productType: "Sink-Base", config: approvedConfig }],
          shared: { CabinetColor: "Nero 433 MT" },
          flow,
        }),
      ).toMatchObject({ status: "applied" });
      expect(scene.presetProducts).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            name: "Tricot-sink-cabinet",
            Drawers: "1DWID",
            CabinetColor: "Zafferano 412 Lacquered MT",
            CabinetPattern: "Loden",
          }),
        ],
        { CabinetColor: "Nero 433 Lacquered MT" },
      );
    },
  );

  it.each([{ DrawerPanelFluting: "Velvet" }, { CabinetColor: "Velvet" }, { Height: 52 }])(
    "rejects invalid product config %j before add/insert/preset/restore can mutate the scene",
    async (extra) => {
      const scene = fakeScene();
      const reader = createTestSceneReader().reader;
      const port = createCompositionPort({ getBindings: () => bindings, scene, reader });
      const product = { productType: "Sink-Base", config: { ...approvedConfig, ...extra } };
      expect(await port.add(product, { kind: "end" })).toMatchObject({ status: "rejected" });
      expect(await port.add(product, { kind: "beside", anchorRuntimeId: "existing", side: "right" })).toMatchObject({
        status: "rejected",
      });
      expect(await port.replace({ products: [product], flow: "prebuilt" })).toMatchObject({ status: "rejected" });
      const restorer = createSceneRestorer({ getBindings: () => bindings, scene, reader });
      expect(await restorer.restore({ products: [{ sourceId: "saved", ...product }] })).toMatchObject({
        status: "rejected",
      });
      expect(scene.addProduct).not.toHaveBeenCalled();
      expect(scene.insertProduct).not.toHaveBeenCalled();
      expect(scene.presetProducts).not.toHaveBeenCalled();
      expect(scene.clear).not.toHaveBeenCalled();
    },
  );

  it("places every model's recipe, leaving its pending choices out of the scene", async () => {
    const scene = fakeScene();
    const port = createCompositionPort({ getBindings: () => bindings, scene, reader: createTestSceneReader().reader });
    for (const preset of presets) {
      expect(
        await port.replace({
          products: preset.presetProducts.map(({ name, ...config }) => ({ productType: name, config })),
          flow: "prebuilt",
        }),
        preset.title,
      ).toMatchObject({ status: "applied" });
    }
    expect(scene.presetProducts).toHaveBeenCalledTimes(presets.length);
    for (const [products] of scene.presetProducts.mock.calls) {
      for (const product of products) {
        expect(product).toMatchObject({
          CabinetPattern: "Cannette",
          HandleGrooveColor: "Nero 433 Lacquered MT",
          CountertopColor: "Matte White",
        });
        expect(Object.keys(product).filter((key) => NOT_SENT.includes(key))).toEqual([]);
        expectBasinOnSinkBaseOnly(product);
      }
    }
  });

  it("adds a recipe's cabinet at the end and beside another without its pending choices", async () => {
    const scene = fakeScene();
    const port = createCompositionPort({ getBindings: () => bindings, scene, reader: createTestSceneReader().reader });
    const { name, ...config } = presets[0].presetProducts[0];
    const product = { productType: name, config };
    expect(await port.add(product, { kind: "end" })).toMatchObject({ status: "applied" });
    expect(
      await port.add(product, { kind: "beside", anchorRuntimeId: "Tricot-side-cabinet-r2", side: "right" }),
    ).toMatchObject({ status: "applied" });

    const [[, added]] = scene.addProduct.mock.calls;
    const [[, , , inserted = {}]] = scene.insertProduct.mock.calls;
    for (const sent of [added, inserted]) {
      expect(sent).toMatchObject({
        Width: config.Width,
        CabinetPattern: "Cannette",
        HandleGrooveColor: "Nero 433 Lacquered MT",
        CountertopColor: "Matte White",
        sinkType: "Top_HPLPrisma",
      });
      expect(Object.keys(sent).filter((key) => NOT_SENT.includes(key))).toEqual([]);
    }
  });

  it.each(["prebuilt", "custom"] as const)("places a recipe with its basin but not its wood in %s", async (flow) => {
    const products = [{ productType: "Sink-Base", config: approvedConfig }];
    const scene = fakeScene();
    const port = createCompositionPort({
      getBindings: () => bindings,
      scene,
      reader: createTestSceneReader().reader,
    });
    expect(
      await port.replace({
        products,
        shared: {
          CabinetColor: "Rovere Oro 932",
          CountertopColor: "Matte White",
          sinkType: "LB440",
          CountertopStyle: "Integrated",
          HandleGrooveColor: "Nero 433 MT",
        },
        flow,
      }),
    ).toMatchObject({ status: "applied" });
    // The pending wood stays out; the style is recorded only, as Class records it.
    expect(scene.presetProducts).toHaveBeenCalledWith(expect.any(Array), {
      CountertopColor: "Matte White",
      HandleGrooveColor: "Nero 433 Lacquered MT",
      sinkType: "Top_HPLPrisma",
    });

    const rejectingScene = fakeScene();
    const rejecting = createCompositionPort({
      getBindings: () => bindings,
      scene: rejectingScene,
      reader: createTestSceneReader().reader,
    });
    expect(await rejecting.replace({ products, shared: { CabinetColor: "Velvet" }, flow })).toMatchObject({
      status: "rejected",
    });
    expect(rejectingScene.presetProducts).not.toHaveBeenCalled();
  });

  it.each([
    approvedConfig,
    {
      ...approvedConfig,
      Drawers: "1DWID",
      CabinetColor: "Zafferano 412 Lacquered MT",
      HandleGrooveColor: "Nero 433 Lacquered MT",
      // The scene keeps the pattern under its own key, as getConfig reads it back.
      DrawerPanelFluting: undefined,
      CabinetPattern: "Loden",
    },
  ])("restores semantic or already-translated scene config idempotently", async (config) => {
    const scene = fakeScene();
    const reader = createTestSceneReader();
    reader.setScene(["Tricot-sink-cabinet-r1"], { "Tricot-sink-cabinet-r1": { width: 80, height: 40, depth: 52 } });
    const restorer = createSceneRestorer({ getBindings: () => bindings, scene, reader: reader.reader });
    expect(
      await restorer.restore({
        products: [{ sourceId: "Tricot-sink-cabinet-a1b2c3d4e", productType: "Tricot-sink-cabinet", config }],
      }),
    ).toMatchObject({
      status: "restored",
      matches: [{ sourceId: "Tricot-sink-cabinet-a1b2c3d4e", runtimeId: "Tricot-sink-cabinet-r1" }],
    });
    expect(scene.presetProducts).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Tricot-sink-cabinet",
        Drawers: "1DWID",
        CabinetColor: "Zafferano 412 Lacquered MT",
        CabinetPattern: "Loden",
      }),
    ]);
  });

  it("restores and duplicates a sink base from the config the scene reads back", async () => {
    // getConfig of a Sink Base placed while its wood was pending: the scene's own color and basin.
    const readBack = {
      Width: 80,
      Height: 40,
      Depth: 52,
      Drawers: "1DWID",
      CabinetColor: "Antracite Matte OCF",
      CabinetPattern: "Satin",
      HandleGrooveColor: "Nero 433 Lacquered MT",
      sinkType: "Top_HPLPrisma",
      ProductType: "Tricot-sink-cabinet",
      productType: "Tricot-sink-cabinet",
      entityName: "Tricot-sink-cabinet-a1b2c3d4e",
      category: "cabinets",
      topDrawerType: "Top",
      TopDrawerDividers: { zones: {} },
      BotDrawerDividers: { zones: {} },
      positionX: 0,
      positionY: 0,
      positionZ: 0,
    };
    const scene = fakeScene();
    const reader = createTestSceneReader();
    reader.setScene(["Tricot-sink-cabinet-r1"], { "Tricot-sink-cabinet-r1": { width: 80, height: 40, depth: 52 } });
    const restorer = createSceneRestorer({ getBindings: () => bindings, scene, reader: reader.reader });
    expect(
      await restorer.restore({
        products: [{ sourceId: "Tricot-sink-cabinet-a1b2c3d4e", productType: "Tricot-sink-cabinet", config: readBack }],
      }),
    ).toMatchObject({ status: "restored" });
    const port = createCompositionPort({ getBindings: () => bindings, scene, reader: reader.reader });
    expect(
      await port.add(
        { productType: "Tricot-sink-cabinet", config: readBack },
        { kind: "beside", anchorRuntimeId: "Tricot-sink-cabinet-r1", side: "right" },
      ),
    ).toMatchObject({ status: "applied" });

    const [[[restored]]] = scene.presetProducts.mock.calls;
    const [[, , , duplicated = {}]] = scene.insertProduct.mock.calls;
    for (const sent of [restored, duplicated]) {
      expect(sent).toMatchObject({
        Drawers: "1DWID",
        CabinetPattern: "Satin",
        HandleGrooveColor: "Nero 433 Lacquered MT",
        // The scene's basin reads back as LB440 and goes back as the same sub-product.
        sinkType: "Top_HPLPrisma",
      });
      expect(sent).not.toHaveProperty("CabinetColor");
    }
  });
});

describe("Tricot confirmed commands through production runtime bindings", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(tricotProfile));
    store.dispatch(setActiveCollectionId("tricot"));
    store.dispatch(setActiveRuntimeBindings(bindings));
    store.dispatch(setCabinetCatalog(buildCabinetCatalogFromProfile(tricotProfile, bindings)));
    store.dispatch(syncCabinets(["Tricot-sink-cabinet-a1b2c3d4e", "Tricot-side-cabinet-f5g6h7i8j"]));
    store.dispatch(setCabinetColorMaterial("LACM"));
    for (const cabinet of getCabinetEntries(store.getState()))
      store.dispatch(
        setAttributeValue({
          attributeId: "DrawerPanelFluting",
          target: { scope: "cabinet", cabinetId: cabinet.stableKey },
          value: "Loden",
        }),
      );
  });

  it.each(["prebuilt", "custom"] as const)(
    "updates lacquer color and the composition groove with exact assets in %s",
    async (flow) => {
      const apply = vi.fn<SceneBridge["apply"]>(async () => ({
        status: "applied",
        updatedIds: ["Tricot-sink-cabinet-a1b2c3d4e", "Tricot-side-cabinet-f5g6h7i8j"],
      }));
      const runtime = createPlayCanvasRuntimePort({
        getBindings: () => bindings,
        scene: { isReady: () => true, apply },
      });
      const deps = {
        getState: () => store.getState(),
        dispatch: store.dispatch,
        runtime,
        flow,
        configurator: tricotConfigurator,
      };
      expect(
        await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Zafferano 412 MT" }, deps),
      ).toMatchObject({ status: "applied" });
      expect(apply).toHaveBeenCalledWith(expect.anything(), { CabinetColor: "Zafferano 412 Lacquered MT" });
      const groove = await changeAttribute(
        { attributeId: "HandleGrooveColor", scope: "global", value: "Nero 433 Lacquered MT" },
        deps,
      );
      expect(groove, JSON.stringify(groove)).toMatchObject({ status: "applied" });
      // Every placed cabinet takes the groove, as they take the cabinet colour.
      expect(apply).toHaveBeenLastCalledWith(
        { productIds: ["Tricot-sink-cabinet-a1b2c3d4e", "Tricot-side-cabinet-f5g6h7i8j"] },
        { HandleGrooveColor: "Nero 433 Lacquered MT" },
      );
      expect(getAttributeValue(store.getState(), "HandleGrooveColor", { scope: "global" })).toBe("Nero 433 MT");
      expect(getAttributeValue(store.getState(), "CabinetColor", { scope: "global" })).toBe("Zafferano 412 MT");
    },
  );

  it("sends a cabinet's pattern to that cabinet alone, as the scene's CabinetPattern", async () => {
    const apply = vi.fn<SceneBridge["apply"]>(async () => ({
      status: "applied",
      updatedIds: ["Tricot-sink-cabinet-a1b2c3d4e"],
    }));
    const runtime = createPlayCanvasRuntimePort({ getBindings: () => bindings, scene: { isReady: () => true, apply } });
    const deps = {
      getState: () => store.getState(),
      dispatch: store.dispatch,
      runtime,
      flow: "custom" as const,
      configurator: tricotConfigurator,
    };
    const cabinetId = getCabinetEntries(store.getState())[0].stableKey;
    store.dispatch(
      setAttributeValue({
        attributeId: "DrawerPanelFluting",
        target: { scope: "cabinet", cabinetId },
        value: "Cannette",
      }),
    );

    expect(
      await changeAttribute({ attributeId: "DrawerPanelFluting", scope: "cabinet", cabinetId, value: "Loden" }, deps),
    ).toMatchObject({ status: "applied" });
    expect(apply).toHaveBeenCalledWith({ productIds: ["Tricot-sink-cabinet-a1b2c3d4e"] }, { CabinetPattern: "Loden" });
    expect(getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId })).toBe("Loden");
  });

  it("moves every cabinet to Loden in the scene when a lacquer color rules out its wood pattern", async () => {
    const apply = vi.fn<SceneBridge["apply"]>(async () => ({
      status: "applied",
      updatedIds: ["Tricot-sink-cabinet-a1b2c3d4e", "Tricot-side-cabinet-f5g6h7i8j"],
    }));
    const runtime = createPlayCanvasRuntimePort({ getBindings: () => bindings, scene: { isReady: () => true, apply } });
    const deps = {
      getState: () => store.getState(),
      dispatch: store.dispatch,
      runtime,
      flow: "prebuilt" as const,
      configurator: tricotConfigurator,
    };
    const cabinets = getCabinetEntries(store.getState());
    store.dispatch(setCabinetColorMaterial("WDV"));
    for (const { stableKey } of cabinets)
      store.dispatch(
        setAttributeValue({
          attributeId: "DrawerPanelFluting",
          target: { scope: "cabinet", cabinetId: stableKey },
          value: "Cannette",
        }),
      );

    expect(
      await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Zafferano 412 MT" }, deps),
    ).toMatchObject({ status: "applied" });
    expect(apply).toHaveBeenCalledWith(expect.anything(), { CabinetColor: "Zafferano 412 Lacquered MT" });
    for (const { runtimeId, stableKey } of cabinets) {
      expect(apply).toHaveBeenCalledWith({ productIds: [runtimeId] }, { CabinetPattern: "Loden" });
      expect(
        getAttributeValue(store.getState(), "DrawerPanelFluting", { scope: "cabinet", cabinetId: stableKey }),
      ).toBe("Loden");
    }
  });

  it("rejects pending panel and wood commands without applying a dependent partial change", async () => {
    const apply = vi.fn<SceneBridge["apply"]>(async () => ({ status: "applied", updatedIds: [] }));
    const runtime = createPlayCanvasRuntimePort({ getBindings: () => bindings, scene: { isReady: () => true, apply } });
    const deps = {
      getState: () => store.getState(),
      dispatch: store.dispatch,
      runtime,
      flow: "custom" as const,
      configurator: tricotConfigurator,
    };
    // A wood color would also move each Loden cabinet to a wood pattern; neither change may reach the scene alone.
    for (const change of [
      { attributeId: "SidePanels", scope: "global" as const, value: "Yes" },
      { attributeId: "CabinetColor", scope: "global" as const, value: "Rovere Oro 932" },
    ]) {
      expect((await changeAttribute(change, deps)).status).not.toBe("applied");
    }
    expect(apply).not.toHaveBeenCalled();
  });
});
