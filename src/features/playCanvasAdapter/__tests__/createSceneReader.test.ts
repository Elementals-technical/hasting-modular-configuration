import { describe, expect, it } from "vitest";

import type { SceneProductsRead } from "@/utils/functions/playcanvas/sceneBridge";

import { createSceneReader } from "../lib/createSceneReader";
import type { SceneReadBridge } from "../lib/createSceneReader";

const fakeScene = (answer: SceneProductsRead): SceneReadBridge & { calls: string[][] } => {
  const calls: string[][] = [];
  return {
    calls,
    async read(productIds) {
      calls.push([...productIds]);
      return answer;
    },
  };
};

describe("createSceneReader", () => {
  it("reports each cabinet's own size and the scene's order", async () => {
    const scene = fakeScene({
      status: "ready",
      order: ["rt-b", "rt-a", "countertop-1"],
      configs: {
        "rt-a": { Width: 60, Height: 50, Depth: 46 },
        "rt-b": { Width: 80, Height: 56, Depth: 50.5 },
      },
    });

    const result = await createSceneReader({ scene }).read(["rt-a", "rt-b"]);

    expect(scene.calls).toEqual([["rt-a", "rt-b"]]);
    expect(result).toEqual({
      status: "ready",
      order: ["rt-b", "rt-a", "countertop-1"],
      cabinets: [
        { runtimeId: "rt-a", dimensions: { width: 60, height: 50, depth: 46 } },
        { runtimeId: "rt-b", dimensions: { width: 80, height: 56, depth: 50.5 } },
      ],
    });
  });

  it("reads numeric strings and leaves a missing size empty", async () => {
    const scene = fakeScene({
      status: "ready",
      order: ["rt-a"],
      configs: { "rt-a": { Width: "60,5", Height: "", Depth: { 46: "46 cm" } } },
    });

    const result = await createSceneReader({ scene }).read(["rt-a"]);

    expect(result).toMatchObject({
      cabinets: [{ runtimeId: "rt-a", dimensions: { width: 60.5, height: null, depth: null } }],
    });
  });

  it("gives a product the scene has no config for no size, not a neighbour's", async () => {
    const scene = fakeScene({
      status: "ready",
      order: ["rt-a", "rt-b"],
      configs: { "rt-a": { Width: 60, Height: 50, Depth: 46 } },
    });

    const result = await createSceneReader({ scene }).read(["rt-a", "rt-b"]);

    expect(result).toMatchObject({ cabinets: [{ runtimeId: "rt-a" }] });
    expect(result.status === "ready" && result.cabinets).toHaveLength(1);
  });

  it("answers not-ready when the scene cannot be read", async () => {
    const result = await createSceneReader({ scene: fakeScene({ status: "not-ready" }) }).read(["rt-a"]);

    expect(result).toEqual({ status: "not-ready" });
  });
});
