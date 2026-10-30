import { beforeEach, describe, expect, it, vi } from "vitest";

import { makoRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { ushRuntimeBindings } from "@/entities/collection/lib/runtimeBindings/__tests__/ushRuntimeBindingsFixture";
import { setSceneProductConfig } from "@/utils/functions/playcanvas/sceneBridge";

import { ensureCabinetHeights } from "../lib/ensureCabinetHeights";
import { createTestSceneReader } from "../lib/testSceneReader";

vi.mock("@/utils/functions/playcanvas/sceneBridge", () => ({
  readSceneProducts: vi.fn(async () => ({ status: "ready", configs: {} })),
  setSceneProductConfig: vi.fn(async () => ({ status: "applied" })),
}));

const sceneWith = (height: number) => {
  const reader = createTestSceneReader();
  reader.setScene(["cab-a"], { "cab-a": { width: 60, height, depth: 52 } });
  return reader.reader;
};

describe("ensureCabinetHeights", () => {
  beforeEach(() => {
    vi.mocked(setSceneProductConfig).mockClear();
  });

  it("sends the height again to a cabinet the scene left behind", async () => {
    const result = await ensureCabinetHeights(
      { runtimeIds: ["cab-a"], height: 56, patch: { Drawers: "2D" }, bindings: ushRuntimeBindings },
      sceneWith(53),
    );

    expect(result).toEqual({ resent: ["cab-a"] });
    expect(setSceneProductConfig).toHaveBeenCalledWith("cab-a", { Drawers: "2D", Height: 56 });
  });

  it("does not overwrite a Mako height with one the Mako scene cannot take", async () => {
    // The Mako cabinet is 26 cm from its one-drawer style; 56 comes from the builder catalog.
    const result = await ensureCabinetHeights(
      { runtimeIds: ["cab-a"], height: 56, patch: { Drawers: "1D" }, bindings: makoRuntimeBindings },
      sceneWith(26),
    );

    expect(result).toEqual({ resent: [] });
    expect(setSceneProductConfig).not.toHaveBeenCalled();
  });
});
