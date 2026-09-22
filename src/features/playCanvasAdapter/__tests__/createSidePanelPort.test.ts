import { describe, expect, it } from "vitest";

import type { ScenePatch } from "@/entities/collection";
import type { SceneCallResult, SceneSelector } from "@/utils/functions/playcanvas/sceneBridge";

import { createSidePanelPort } from "../lib/createSidePanelPort";

const createFakeScene = (answers: SceneCallResult[] = []) => {
  const patches: ScenePatch[] = [];
  const remembered: [string, string][] = [];
  const pending = [...answers];

  const port = createSidePanelPort({
    scene: {
      isReady: () => true,
      async apply(_selector: SceneSelector, patch: ScenePatch) {
        patches.push(patch);
        return pending.shift() ?? { status: "applied", updatedIds: null };
      },
    },
    remember: (panel, side) => remembered.push([panel, side]),
  });

  return { port, patches, remembered };
};

describe("createSidePanelPort", () => {
  it("places each panel with its side, and a single cabinet on both edges", async () => {
    const { port, patches, remembered } = createFakeScene();

    expect(await port.apply([{ panel: "UpperG", side: "left" }], 1)).toEqual({ status: "applied" });

    expect(patches).toEqual([{ SidePanel: "UpperG", SidePanelSide: "both" }]);
    expect(remembered).toEqual([["UpperG", "both"]]);
  });

  it("removes both panels side by side, as the scene does not remove both at once", async () => {
    const { port, patches } = createFakeScene();

    await port.apply(
      [
        { panel: "None", side: "both" },
        { panel: "CenterG", side: "right" },
      ],
      3,
    );

    expect(patches).toEqual([
      { SidePanel: "None", SidePanelSide: "left" },
      { SidePanel: "None", SidePanelSide: "right" },
      { SidePanel: "CenterG", SidePanelSide: "right" },
    ]);
  });

  it("reports a failure after the scene changed as partial, and remembers only what it took", async () => {
    const { port, remembered } = createFakeScene([
      { status: "applied", updatedIds: null },
      { status: "applied", updatedIds: null },
      { status: "failed", code: "scene-rejected", message: "no panel" },
    ]);

    const result = await port.apply(
      [
        { panel: "None", side: "both" },
        { panel: "CenterG", side: "right" },
      ],
      3,
    );

    expect(result).toEqual({ status: "partial", message: "no panel" });
    expect(remembered).toEqual([["None", "both"]]);
  });

  it("reports a first failure as failed", async () => {
    const { port } = createFakeScene([{ status: "failed", code: "scene-rejected", message: "no panel" }]);

    expect(await port.apply([{ panel: "UpperG", side: "left" }], 2)).toEqual({ status: "failed", message: "no panel" });
  });
});
