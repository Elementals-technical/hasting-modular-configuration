import { describe, expect, it } from "vitest";

import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import type { RuntimeBindingSet, ScenePatch } from "@/entities/collection";
import type { RuntimeChange, RuntimeContext } from "@/entities/configuration";
import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { createPlayCanvasRuntimePort } from "../lib/createPlayCanvasRuntimePort";
import type { SceneBridge } from "../lib/createPlayCanvasRuntimePort";

const CABINETS = ["rt-1", "rt-2"];

type FakeScene = SceneBridge & {
  calls: { selector: SceneSelector; patch: ScenePatch }[];
  answers: Map<number, SceneCallResult>;
};

const createFakeScene = (): FakeScene => {
  const scene: FakeScene = {
    calls: [],
    answers: new Map(),
    isReady: () => true,
    async apply(selector, patch) {
      const index = scene.calls.push({ selector, patch }) - 1;
      return scene.answers.get(index) ?? { status: "applied", updatedIds: selector.productIds ?? CABINETS };
    },
  };
  return scene;
};

const context: RuntimeContext = {
  collectionId: "urban-standard-height",
  flow: "prebuilt",
  resolveRuntimeId: (cabinetId) => (cabinetId === "cab-1" ? "rt-1" : null),
  cabinetRuntimeIds: CABINETS,
};

const change = (attributeId: string, value: RuntimeChange["value"]): RuntimeChange => ({
  attributeId,
  target: attributeId === "Drawers" ? { scope: "cabinet", cabinetId: "cab-1" } : { scope: "global" },
  value,
});

const setUp = (bindings: RuntimeBindingSet = ushRuntimeBindings) => {
  const scene = createFakeScene();
  const port = createPlayCanvasRuntimePort({ getBindings: () => bindings, scene });
  return { scene, port };
};

const sentPatches = (scene: FakeScene) => scene.calls.map(({ patch }) => patch);

describe("execution order", () => {
  it("sends drawers before the handle and the handle before the height, whatever order C used", async () => {
    const { scene, port } = setUp();

    const result = await port.apply(
      [change("Height", 56), change("Handle", "handle_pto"), change("Drawers", "2")],
      context,
    );

    expect(sentPatches(scene)).toEqual([{ Drawers: "2D" }, { Handle: "handle_pto" }, { Height: 56 }]);
    // The result keeps C's own objects, in the order they were applied.
    expect(result).toMatchObject({
      status: "applied",
      applied: [{ attributeId: "Drawers" }, { attributeId: "Handle" }, { attributeId: "Height" }],
    });
  });

  it("sends the basin before its color and the towel bar before its color", async () => {
    const { scene, port } = setUp();

    await port.apply(
      [
        change("TowelBarColor", "Chrome"),
        change("VesselColor", "Matte White"),
        change("TowelBarOption", "Left"),
        change("sinkType", "Vessel_Blade11"),
      ],
      context,
    );

    expect(sentPatches(scene)).toEqual([
      { sinkType: "Vessel_Blade11" },
      { VesselColor: "Matte White" },
      { TowelBar: "None", TowelBarSide: "both" },
      { TowelBar: "TowelBar40_R", TowelBarSide: "left" },
      { TowelBarColor: "Chrome" },
    ]);
  });

  it("keeps C's order within one phase", async () => {
    const { scene, port } = setUp();

    await port.apply([change("GrainDirection", "GrainVertical"), change("CabinetColor", "Walnut")], context);

    expect(sentPatches(scene)).toEqual([{ GrainDirection: "GrainVertical" }, { CabinetColor: "Walnut" }]);
  });

  it("sends a binding without a declared phase after every declared one", async () => {
    const bindings: RuntimeBindingSet = {
      schemaVersion: 1,
      collectionId: "urban-standard-height",
      productTypes: {},
      bindings: [
        {
          attributeId: "Late",
          status: "bound",
          target: { kind: "all" },
          values: { kind: "identity", sceneKey: "Late" },
        },
        {
          attributeId: "Early",
          status: "bound",
          target: { kind: "all" },
          values: { kind: "identity", sceneKey: "Early" },
          order: 5,
        },
      ],
    };
    const { scene, port } = setUp(bindings);

    await port.apply([change("Late", "x"), change("Early", "y")], context);

    expect(sentPatches(scene)).toEqual([{ Early: "y" }, { Late: "x" }]);
  });
});

describe("steps of one value", () => {
  it("clears the towel bar before setting a side", async () => {
    const { scene, port } = setUp();

    expect(await port.apply([change("TowelBarOption", "Right")], context)).toMatchObject({ status: "applied" });
    expect(sentPatches(scene)).toEqual([
      { TowelBar: "None", TowelBarSide: "both" },
      { TowelBar: "TowelBar40_R", TowelBarSide: "right" },
    ]);
  });

  it("sends the clearing once when the value itself is the clearing", async () => {
    const { scene, port } = setUp();

    await port.apply([change("TowelBarOption", "None")], context);

    expect(sentPatches(scene)).toEqual([{ TowelBar: "None", TowelBarSide: "both" }]);
  });

  it("reports partial, not failed, when the clearing went through and the side did not", async () => {
    const { scene, port } = setUp();
    scene.answers.set(0, { status: "applied", updatedIds: null });
    scene.answers.set(1, { status: "failed", code: "scene-rejected", message: "no mesh" });

    const result = await port.apply([change("TowelBarOption", "Left"), change("TowelBarColor", "Chrome")], context);

    expect(result).toEqual({
      status: "partial",
      applied: [],
      failed: [
        { change: change("TowelBarOption", "Left"), code: "scene-rejected", message: "no mesh" },
        { change: change("TowelBarColor", "Chrome"), code: "not-attempted", message: expect.any(String) },
      ],
    });
  });
});

describe("one action, no repeated command", () => {
  it("sends an identical command once per set", async () => {
    const { scene, port } = setUp();

    const result = await port.apply([change("Height", 56), change("Height", 56)], context);

    expect(scene.calls).toHaveLength(1);
    expect(result).toMatchObject({
      status: "applied",
      applied: [{ attributeId: "Height" }, { attributeId: "Height" }],
    });
  });
});

describe("a broadcast reaches every cabinet", () => {
  it("does not call a broadcast that skipped a cabinet a success", async () => {
    const { scene, port } = setUp();
    scene.answers.set(0, { status: "applied", updatedIds: ["rt-1", "countertop-1"] });

    const result = await port.apply([change("Height", 56)], context);

    // rt-1 did change, so the scene is no longer what C had: partial, not failed.
    expect(result).toMatchObject({
      status: "partial",
      applied: [],
      failed: [{ code: "product-not-found", message: expect.stringContaining("rt-2") }],
    });
  });

  it("reports failed when the broadcast updated nothing", async () => {
    const { scene, port } = setUp();
    scene.answers.set(0, { status: "applied", updatedIds: [] });

    expect(await port.apply([change("Height", 56)], context)).toMatchObject({
      status: "failed",
      failed: [{ code: "product-not-found" }],
    });
  });

  it("does not expect cabinets from an add-on, which reports no product ids", async () => {
    const { scene, port } = setUp();
    scene.answers.set(0, { status: "applied", updatedIds: null });

    expect(await port.apply([change("TowelBarColor", "Chrome")], context)).toMatchObject({ status: "applied" });
  });
});
