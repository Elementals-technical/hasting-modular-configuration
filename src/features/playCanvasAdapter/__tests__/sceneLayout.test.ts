import { describe, expect, it, vi } from "vitest";

import type { SceneLayout } from "@/entities/configuration";
import type { ConfiguratorPreset } from "@/features/configuratorApi";

import { captureSceneLayout, importSceneLayout, parseSceneLayout } from "../lib/sceneLayout";
import type { SceneLayoutClient } from "../lib/sceneLayout";

/**
 * The layout of a two-row composition: a sink base with a side cabinet under it. The scene
 * document is opaque to the app, so the tests only shape the parts the adapter reads.
 */

const sceneDocument = (definitionIds = ["ULH-sink-cabinet", "ULH-side-cabinet"]): ConfiguratorPreset => ({
  presetSchemaVersion: 2,
  collection: { id: "ULH" },
  presetProducts: definitionIds.map((definitionId, index) => ({ key: `cabinet${index}`, definitionId })),
  presetLayout: { layoutMode: "exact" },
});

const LAYOUT: SceneLayout = {
  version: 1,
  document: sceneDocument(),
  cabinetIds: { cabinet0: "sink-old", cabinet1: "side-old" },
};

const coded = (code: string) => Object.assign(new Error(code), { code });

const createFakeClient = () => {
  const revisions: number[] = [];
  const client = {
    connect: vi.fn(async () => client as unknown as Awaited<ReturnType<SceneLayoutClient["connect"]>>),
    /** Answers the queued revisions, then keeps answering the last one. */
    getCompositionRevision: vi.fn(async () =>
      revisions.length > 1 ? (revisions.shift() as number) : (revisions[0] ?? 7),
    ),
    getCabinetsState: vi.fn(async () => ({
      cabinets: [
        { id: "sink-now", definitionId: "ULH-sink-cabinet", selection: {}, positionM: { x: 0, y: 0, z: 0 } },
        { id: "side-now", definitionId: "ULH-side-cabinet", selection: {}, positionM: { x: 0, y: -0.38, z: 0 } },
      ],
      connections: [],
      selectedCabinetId: null,
    })),
    exportPreset: vi.fn(async () => sceneDocument()),
    importPreset: vi.fn(async () => ({
      requestId: "import-1",
      kind: "import",
      keyToProductId: { cabinet0: "sink-new", cabinet1: "side-new" } as Record<string, string>,
    })),
    dispose: vi.fn(),
  };

  return { client, revisions, createClient: () => client as unknown as SceneLayoutClient };
};

describe("parseSceneLayout", () => {
  it("accepts a layout as it was captured", () => {
    expect(parseSceneLayout(JSON.parse(JSON.stringify(LAYOUT)))).toEqual(LAYOUT);
  });

  it.each([
    ["nothing", null],
    ["another version", { ...LAYOUT, version: 2 }],
    ["a document without products", { ...LAYOUT, document: { ...LAYOUT.document, presetProducts: undefined } }],
    ["a document without a layout", { ...LAYOUT, document: { ...LAYOUT.document, presetLayout: null } }],
    ["no cabinet ids", { ...LAYOUT, cabinetIds: {} }],
    ["an empty cabinet id", { ...LAYOUT, cabinetIds: { cabinet0: "", cabinet1: "side-old" } }],
    ["one id for two cabinets", { ...LAYOUT, cabinetIds: { cabinet0: "same", cabinet1: "same" } }],
    ["a key the document does not have", { ...LAYOUT, cabinetIds: { cabinet0: "sink-old", cabinet9: "side-old" } }],
  ])("refuses %s", (_, value) => {
    expect(parseSceneLayout(value)).toBeNull();
  });
});

describe("captureSceneLayout", () => {
  it("pairs each cabinet of the document with the runtime id at the same position", async () => {
    const { client, createClient } = createFakeClient();

    const layout = await captureSceneLayout({ createClient });

    expect(layout).toEqual({
      version: 1,
      document: sceneDocument(),
      cabinetIds: { cabinet0: "sink-now", cabinet1: "side-now" },
    });
    expect(client.exportPreset).toHaveBeenCalledWith("sink-now");
    expect(client.dispose).toHaveBeenCalledTimes(1);
  });

  it("reads again when the composition changed between the cabinets and the document", async () => {
    const { client, revisions, createClient } = createFakeClient();
    revisions.push(7, 8, 8);

    expect(await captureSceneLayout({ createClient })).not.toBeNull();
    expect(client.exportPreset).toHaveBeenCalledTimes(2);
  });

  it("gives up when the composition keeps changing", async () => {
    const { client, createClient } = createFakeClient();
    let revision = 0;
    client.getCompositionRevision.mockImplementation(async () => (revision += 1));

    expect(await captureSceneLayout({ createClient })).toBeNull();
    expect(client.exportPreset).toHaveBeenCalledTimes(2);
  });

  it("has no layout for an empty composition", async () => {
    const { client, createClient } = createFakeClient();
    client.getCabinetsState.mockResolvedValue({ cabinets: [], connections: [], selectedCabinetId: null });

    expect(await captureSceneLayout({ createClient })).toBeNull();
    expect(client.exportPreset).not.toHaveBeenCalled();
  });

  it("does not pair a document that lists other cabinets than the scene holds", async () => {
    const { client, createClient } = createFakeClient();
    client.exportPreset.mockResolvedValue(sceneDocument(["ULH-side-cabinet", "ULH-sink-cabinet"]));

    expect(await captureSceneLayout({ createClient })).toBeNull();
  });

  it.each(["COMPOSITION_BUSY", "UNSUPPORTED", "CONFIGURATOR_READY_TIMEOUT"])(
    "resolves null instead of failing when the scene answers %s",
    async (code) => {
      const { client, createClient } = createFakeClient();
      client.exportPreset.mockRejectedValue(coded(code));

      expect(await captureSceneLayout({ createClient })).toBeNull();
      expect(client.dispose).toHaveBeenCalledTimes(1);
    },
  );

  it("does not wait for a scene that takes longer than the budget", async () => {
    const { client, createClient } = createFakeClient();
    client.connect.mockImplementation(() => new Promise(() => undefined));

    expect(await captureSceneLayout({ createClient, budgetMs: 5 })).toBeNull();
    expect(client.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("importSceneLayout", () => {
  it("gives the scene its document back and maps every saved id to its new one", async () => {
    const { client, createClient } = createFakeClient();

    const result = await importSceneLayout(LAYOUT, ["side-old", "sink-old"], { createClient });

    expect(result).toEqual({ status: "imported", runtimeIds: { "sink-old": "sink-new", "side-old": "side-new" } });
    expect(client.importPreset).toHaveBeenCalledWith(LAYOUT.document);
    expect(client.dispose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["fewer products", ["sink-old"]],
    ["more products", ["sink-old", "side-old", "shelf-old"]],
    ["other products", ["sink-old", "shelf-old"]],
  ])("does not send a layout written for %s", async (_, sourceIds) => {
    const { client, createClient } = createFakeClient();

    expect(await importSceneLayout(LAYOUT, sourceIds, { createClient })).toEqual({
      status: "unusable",
      code: "layout-mismatch",
    });
    expect(client.connect).not.toHaveBeenCalled();
  });

  it("sends the document once more when the composition moved on meanwhile", async () => {
    const { client, createClient } = createFakeClient();
    client.importPreset.mockRejectedValueOnce(coded("STALE_COMPOSITION"));

    expect((await importSceneLayout(LAYOUT, ["sink-old", "side-old"], { createClient })).status).toBe("imported");
    expect(client.importPreset).toHaveBeenCalledTimes(2);
  });

  it.each(["COMPOSITION_BUSY", "LEGACY_WRITERS_BUSY", "CONFIGURATOR_READY_TIMEOUT"])(
    "reports a busy scene (%s) as not ready, so the same layout can be sent again",
    async (code) => {
      const { client, createClient } = createFakeClient();
      client.importPreset.mockRejectedValue(coded(code));

      expect(await importSceneLayout(LAYOUT, ["sink-old", "side-old"], { createClient })).toEqual({
        status: "not-ready",
        code,
      });
      expect(client.dispose).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["PRESET_INVALID_DOCUMENT", "PRESET_COLLECTION_UNSUPPORTED", "RECOVERY_REQUIRED", "API_METHOD_UNAVAILABLE"])(
    "reports a layout the scene refuses (%s) as unusable",
    async (code) => {
      const { client, createClient } = createFakeClient();
      client.importPreset.mockRejectedValue(coded(code));

      expect(await importSceneLayout(LAYOUT, ["sink-old", "side-old"], { createClient })).toEqual({
        status: "unusable",
        code,
      });
    },
  );

  it("does not trust a receipt that leaves a cabinet without its new id", async () => {
    const { client, createClient } = createFakeClient();
    client.importPreset.mockResolvedValue({ requestId: "r", kind: "import", keyToProductId: { cabinet0: "sink-new" } });

    expect(await importSceneLayout(LAYOUT, ["sink-old", "side-old"], { createClient })).toEqual({
      status: "unusable",
      code: "layout-receipt-incomplete",
    });
  });
});
