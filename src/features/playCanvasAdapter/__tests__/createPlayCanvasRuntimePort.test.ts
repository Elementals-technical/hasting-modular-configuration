import { describe, expect, it } from "vitest";

import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { ScenePatch } from "@/entities/collection";
import type { RuntimeChange, RuntimeContext } from "@/entities/configuration";
import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { createPlayCanvasRuntimePort } from "../lib/createPlayCanvasRuntimePort";
import type { SceneBridge } from "../lib/createPlayCanvasRuntimePort";

type FakeScene = SceneBridge & {
  calls: { selector: SceneSelector; patch: ScenePatch }[];
  productCalls: { runtimeId: string; patch: ScenePatch }[];
  ready: boolean;
  /** Answers per call index; unlisted calls apply. */
  answers: Map<number, SceneCallResult>;
};

const createFakeScene = (): FakeScene => {
  const scene: FakeScene = {
    calls: [],
    productCalls: [],
    ready: true,
    answers: new Map(),
    isReady: () => scene.ready,
    async apply(selector, patch) {
      const index = scene.calls.push({ selector, patch }) - 1;
      // Like the real scene: a broadcast updates every product.
      return scene.answers.get(index) ?? { status: "applied", updatedIds: selector.productIds ?? ALL_PRODUCTS };
    },
    async applyProduct(runtimeId, patch) {
      scene.productCalls.push({ runtimeId, patch });
      return { status: "applied", updatedIds: [runtimeId] };
    },
  };
  return scene;
};

const RUNTIME_IDS: Record<string, string> = { "cab-1": "rt-1", "cab-2": "rt-2" };
const ALL_PRODUCTS = ["rt-1", "rt-2", "countertop-1"];

const context = (overrides: Partial<RuntimeContext> = {}): RuntimeContext => ({
  collectionId: "urban-standard-height",
  flow: "custom",
  resolveRuntimeId: (cabinetId) => RUNTIME_IDS[cabinetId] ?? null,
  cabinetRuntimeIds: ["rt-1", "rt-2"],
  ...overrides,
});

const drawers = (value: string, cabinetId = "cab-1"): RuntimeChange => ({
  attributeId: "Drawers",
  target: { scope: "cabinet", cabinetId },
  value,
});

const height = (value: number): RuntimeChange => ({ attributeId: "Height", target: { scope: "global" }, value });

const setUp = () => {
  const scene = createFakeScene();
  const port = createPlayCanvasRuntimePort({ getBindings: () => ushRuntimeBindings, scene });
  return { scene, port };
};

describe("createPlayCanvasRuntimePort", () => {
  it("delegates a translated change to the addressed product", async () => {
    const { scene, port } = setUp();

    const result = await port.apply([drawers("2")], context());

    expect(result).toEqual({ status: "applied", applied: [drawers("2")] });
    expect(scene.calls).toEqual([{ selector: { productIds: ["rt-1"] }, patch: { Drawers: "2D" } }]);
  });

  it("keeps Width on the scene's direct-product resize API", async () => {
    const { scene, port } = setUp();
    const width: RuntimeChange = { attributeId: "Width", target: { scope: "cabinet", cabinetId: "cab-2" }, value: 80 };

    await expect(port.apply([width], context())).resolves.toEqual({ status: "applied", applied: [width] });
    expect(scene.productCalls).toEqual([{ runtimeId: "rt-2", patch: { Width: 80 } }]);
    expect(scene.calls).toEqual([]);
  });

  it("broadcasts the height and runs the set in the planned order, one call per change", async () => {
    const { scene, port } = setUp();

    await port.apply([drawers("2"), height(56)], context());

    expect(scene.calls).toEqual([
      { selector: { productIds: ["rt-1"] }, patch: { Drawers: "2D" } },
      { selector: {}, patch: { Height: 56 } },
    ]);
  });

  it("sends a flow-dependent attribute to every product in prebuilt and to the cabinets in custom", async () => {
    const { scene, port } = setUp();
    const grain: RuntimeChange = { attributeId: "GrainDirection", target: { scope: "global" }, value: "GrainVertical" };

    await port.apply([grain], context({ flow: "prebuilt" }));
    await port.apply([grain], context({ flow: "custom" }));

    expect(scene.calls.map(({ selector }) => selector)).toEqual([{}, { productIds: ["rt-1", "rt-2"] }]);
  });

  it("answers not-ready without touching the scene", async () => {
    const { scene, port } = setUp();
    scene.ready = false;

    expect(port.isReady()).toBe(false);
    expect(await port.apply([drawers("2")], context())).toEqual({ status: "not-ready" });
    expect(scene.calls).toHaveLength(0);
  });

  it("sends nothing when any change of the set has no translation", async () => {
    const { scene, port } = setUp();
    const sidePanels: RuntimeChange = { attributeId: "SidePanels", target: { scope: "global" }, value: "UpperG" };

    const result = await port.apply([drawers("2"), drawers("3"), sidePanels], context());

    expect(result).toMatchObject({
      status: "unsupported",
      unsupported: [
        { change: drawers("3"), reason: "unknown-value" },
        { change: sidePanels, reason: "unbound" },
      ],
    });
    expect(scene.calls).toHaveLength(0);
  });

  it("treats bindings of another collection as no bindings at all", async () => {
    const { scene, port } = setUp();

    const result = await port.apply([drawers("2")], context({ collectionId: "mako" }));

    expect(result).toMatchObject({ status: "unsupported", unsupported: [{ reason: "no-binding" }] });
    expect(scene.calls).toHaveLength(0);
  });

  it("fails before any call when a cabinet has no runtime id", async () => {
    const { scene, port } = setUp();

    const result = await port.apply([height(56), drawers("2", "cab-9")], context());

    expect(result).toMatchObject({ status: "failed", failed: [{ code: "unknown-target" }] });
    expect(scene.calls).toHaveLength(0);
  });

  it("keeps the scene's reason when the first command fails", async () => {
    const { scene, port } = setUp();
    scene.answers.set(0, { status: "failed", code: "product-not-found", message: "The scene did not update rt-1." });

    const result = await port.apply([drawers("2"), height(56)], context());

    expect(result).toEqual({
      status: "failed",
      failed: [
        { change: drawers("2"), code: "product-not-found", message: "The scene did not update rt-1." },
        { change: height(56), code: "not-attempted", message: expect.any(String) },
      ],
    });
    expect(scene.calls).toHaveLength(1);
  });

  it("reports a partial result instead of a success when a later command fails", async () => {
    const { scene, port } = setUp();
    scene.answers.set(1, { status: "failed", code: "scene-error", message: "boom" });

    const result = await port.apply([drawers("2"), height(56)], context());

    expect(result).toEqual({
      status: "partial",
      applied: [drawers("2")],
      failed: [{ change: height(56), code: "scene-error", message: "boom" }],
    });
  });

  it("reports not-ready when the scene goes away before the first command runs", async () => {
    const { scene, port } = setUp();
    scene.answers.set(0, { status: "not-ready" });

    expect(await port.apply([drawers("2"), height(56)], context())).toEqual({ status: "not-ready" });
  });

  it("marks the rest of the set not ready when the scene goes away midway", async () => {
    const { scene, port } = setUp();
    scene.answers.set(1, { status: "not-ready" });

    const result = await port.apply([drawers("2"), height(56)], context());

    expect(result).toMatchObject({ status: "partial", applied: [drawers("2")], failed: [{ code: "not-ready" }] });
  });

  it("applies an empty set without calling the scene", async () => {
    const { scene, port } = setUp();

    expect(await port.apply([], context())).toEqual({ status: "applied", applied: [] });
    expect(scene.calls).toHaveLength(0);
  });

  it("has nothing to send to the cabinets when none are placed", async () => {
    const { scene, port } = setUp();
    const fluting: RuntimeChange = { attributeId: "DrawerPanelFluting", target: { scope: "global" }, value: "None" };

    const result = await port.apply([fluting], context({ cabinetRuntimeIds: [] }));

    expect(result).toEqual({ status: "applied", applied: [fluting] });
    expect(scene.calls).toHaveLength(0);
  });

  it("refuses a one-cabinet binding for a change that names no cabinet", async () => {
    const { scene, port } = setUp();
    const globalDrawers: RuntimeChange = { attributeId: "Drawers", target: { scope: "global" }, value: "2" };

    const result = await port.apply([globalDrawers], context());

    expect(result).toMatchObject({ status: "failed", failed: [{ code: "unknown-target" }] });
    expect(scene.calls).toHaveLength(0);
  });

  it("sends the basin to every sink base, since USH has one basin per configuration", async () => {
    const { scene, port } = setUp();
    const basin: RuntimeChange = { attributeId: "sinkType", target: { scope: "basin" }, value: "Vessel_Blade11" };

    expect(await port.apply([basin], context())).toMatchObject({ status: "applied" });
    expect(scene.calls).toEqual([{ selector: { productType: "Sink-Base" }, patch: { sinkType: "Vessel_Blade11" } }]);
  });
});
