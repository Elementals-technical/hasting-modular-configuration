import { describe, expect, it } from "vitest";

import type { ScenePlus, ScenePlusKind } from "@/utils/functions/playcanvas/sceneBridge";

import { placementForPlus, plusFilterFor, rowEndSideOf } from "../plusPlacement";

const plus = (kind: ScenePlusKind, cabinetId = "UD-side-cabinet-1"): ScenePlus => ({
  id: `${kind}:${cabinetId}`,
  kind,
  cabinetId,
});
const ALL_KINDS: ScenePlusKind[] = ["left", "right", "left-top", "right-top", "top", "bottom"];
const typeOf = (runtimeId: string) => (runtimeId.startsWith("UD-sink-cabinet") ? "Sink-Base" : "Sink-Cabinet");
const shown = (filter: (candidate: ScenePlus) => boolean, cabinetId?: string) =>
  ALL_KINDS.filter((kind) => filter(plus(kind, cabinetId)));

describe("plus placement", () => {
  it("adds beside the end cabinet for a row-end '+', at the scene's offered place for the others", () => {
    expect(placementForPlus("left", "a")).toEqual({ kind: "beside", anchorRuntimeId: "a", side: "left" });
    expect(placementForPlus("right", "a")).toEqual({ kind: "beside", anchorRuntimeId: "a", side: "right" });
    // The hanging-level "+" of a row end is that end's place, as the scene offers it.
    expect(placementForPlus("left-top", "a")).toEqual({ kind: "slot", anchorRuntimeId: "a", slot: "left" });
    expect(placementForPlus("right-top", "a")).toEqual({ kind: "slot", anchorRuntimeId: "a", slot: "right" });
    expect(placementForPlus("top", "b")).toEqual({ kind: "slot", anchorRuntimeId: "b", slot: "top" });
    expect(placementForPlus("bottom", "b")).toEqual({ kind: "slot", anchorRuntimeId: "b", slot: "bottom" });
  });

  it("reads the row end of a '+', none for the free place of a column", () => {
    expect(ALL_KINDS.map(rowEndSideOf)).toEqual(["left", "right", "left", "right", null, null]);
  });

  it("shows only the row ends of a plain row while the collection places no columns", () => {
    expect(shown(plusFilterFor("Sink-Cabinet", typeOf, { columns: false }))).toEqual(["left", "right"]);
  });

  it("shows every '+' for a drawer cabinet of a collection with columns", () => {
    expect(shown(plusFilterFor("Sink-Cabinet", typeOf, { columns: true }))).toEqual(ALL_KINDS);
  });

  it("keeps a side shelf at a row end, standing, and an open shelf out of the columns", () => {
    expect(shown(plusFilterFor("Side-Shelf", typeOf, { columns: true }))).toEqual(["left", "right"]);
    expect(shown(plusFilterFor("Open-Shelf", typeOf, { columns: true }))).toEqual([
      "left",
      "right",
      "left-top",
      "right-top",
    ]);
  });

  it("puts nothing on a sink base and no sink base under a cabinet", () => {
    // Over a lone sink base: no "top".
    expect(shown(plusFilterFor("Sink-Cabinet", typeOf, { columns: true }), "UD-sink-cabinet-1")).not.toContain("top");
    // A sink base never goes under a hanging cabinet.
    expect(shown(plusFilterFor("Sink-Base", typeOf, { columns: true }))).not.toContain("bottom");
  });
});
