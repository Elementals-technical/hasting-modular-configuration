import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@/app/store";
import { tricotProfile, tricotRuntimeBindings as bindings } from "@/entities/collection/__tests__/tricotFixtures";
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
};
const fakeScene = () =>
  ({
    isReady: () => true,
    clear: vi.fn(async () => ({ status: "applied" as const })),
    presetProducts: vi.fn(async () => ({ status: "applied" as const, runtimeIds: ["Tricot-sink-cabinet-r1"] })),
    addProduct: vi.fn(async () => ({ status: "applied" as const, runtimeId: "Tricot-side-cabinet-r2" })),
    insertProduct: vi.fn(async () => ({
      status: "applied" as const,
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
      }),
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
          }),
        ],
        { CabinetColor: "Nero 433 Lacquered MT" },
      );
    },
  );

  it.each([
    { DrawerPanelFluting: "Cannette" },
    { SidePanels: "No" },
    { sinkType: "LB440" },
    { CabinetColor: "Rovere Oro 932" },
    { Height: 52 },
  ])(
    "rejects pending/invalid product config %j before add/insert/preset/restore can mutate the scene",
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

  it("keeps every model's recipe intact but blocks their unsupported visual defaults before touching the scene", async () => {
    const scene = fakeScene();
    const port = createCompositionPort({ getBindings: () => bindings, scene, reader: createTestSceneReader().reader });
    for (const preset of presets) {
      expect(
        await port.replace({
          products: preset.presetProducts.map(({ name, ...config }) => ({ productType: name, config })),
          flow: "prebuilt",
        }),
        preset.title,
      ).toMatchObject({ status: "rejected" });
    }
    expect(scene.presetProducts).not.toHaveBeenCalled();
  });

  it.each([
    approvedConfig,
    {
      ...approvedConfig,
      Drawers: "1DWID",
      CabinetColor: "Zafferano 412 Lacquered MT",
      HandleGrooveColor: "Nero 433 Lacquered MT",
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
      }),
    ]);
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
    "updates lacquer color and a cabinet groove with exact assets in %s",
    async (flow) => {
      const apply = vi.fn<SceneBridge["apply"]>(async () => ({
        status: "applied",
        updatedIds: ["Tricot-sink-cabinet-a1b2c3d4e", "Tricot-side-cabinet-f5g6h7i8j"],
      }));
      const runtime = createPlayCanvasRuntimePort({
        getBindings: () => bindings,
        scene: { isReady: () => true, apply },
      });
      const deps = { getState: () => store.getState(), dispatch: store.dispatch, runtime, flow };
      expect(
        await changeAttribute({ attributeId: "CabinetColor", scope: "global", value: "Zafferano 412 MT" }, deps),
      ).toMatchObject({ status: "applied" });
      expect(apply).toHaveBeenCalledWith(expect.anything(), { CabinetColor: "Zafferano 412 Lacquered MT" });
      const cabinetId = getCabinetEntries(store.getState())[0].stableKey;
      const groove = await changeAttribute(
        { attributeId: "HandleGrooveColor", scope: "cabinet", cabinetId, value: "Nero 433 Lacquered MT" },
        deps,
      );
      expect(groove, JSON.stringify(groove)).toMatchObject({ status: "applied" });
      expect(apply).toHaveBeenLastCalledWith(
        { productIds: ["Tricot-sink-cabinet-a1b2c3d4e"] },
        { HandleGrooveColor: "Nero 433 Lacquered MT" },
      );
      expect(getAttributeValue(store.getState(), "CabinetColor", { scope: "global" })).toBe("Zafferano 412 MT");
    },
  );

  it("rejects pending pattern, panel and wood commands without applying a dependent partial change", async () => {
    const apply = vi.fn<SceneBridge["apply"]>(async () => ({ status: "applied", updatedIds: [] }));
    const runtime = createPlayCanvasRuntimePort({ getBindings: () => bindings, scene: { isReady: () => true, apply } });
    const deps = { getState: () => store.getState(), dispatch: store.dispatch, runtime, flow: "custom" as const };
    const cabinetId = getCabinetEntries(store.getState())[0].stableKey;
    for (const change of [
      { attributeId: "DrawerPanelFluting", scope: "cabinet" as const, cabinetId, value: "Loden" },
      { attributeId: "SidePanels", scope: "global" as const, value: "Yes" },
      { attributeId: "CabinetColor", scope: "global" as const, value: "Rovere Oro 932" },
    ]) {
      expect((await changeAttribute(change, deps)).status).not.toBe("applied");
    }
    expect(apply).not.toHaveBeenCalled();
  });
});
