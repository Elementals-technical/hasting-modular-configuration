import { describe, expect, it } from "vitest";

import { organizerDrawerKey } from "../model/types";
import { togglePosition } from "../model/positionsEditor";

describe("togglePosition", () => {
  it("presses a cell of an empty draft", () => {
    expect(togglePosition([], 3, 2)).toEqual({ next: [3], blocked: false });
  });

  it("keeps the draft sorted when a cell is pressed", () => {
    expect(togglePosition([4], 2, 2)).toEqual({ next: [2, 4], blocked: false });
    expect(togglePosition([1, 5], 3, 3)).toEqual({ next: [1, 3, 5], blocked: false });
  });

  it("releases a cell that is pressed", () => {
    expect(togglePosition([2, 4], 2, 2)).toEqual({ next: [4], blocked: false });
    expect(togglePosition([3], 3, 2)).toEqual({ next: [], blocked: false });
  });

  it("releases a cell even when the draft is at maxActive", () => {
    expect(togglePosition([2, 4], 4, 2).blocked).toBe(false);
  });

  it("blocks a third cell and leaves the draft as it was", () => {
    expect(togglePosition([2, 4], 3, 2)).toEqual({ next: [2, 4], blocked: true });
    expect(togglePosition([2], 4, 1)).toEqual({ next: [2], blocked: true });
  });

  it("blocks every cell when nothing may be active", () => {
    expect(togglePosition([], 1, 0)).toEqual({ next: [], blocked: true });
  });

  it("sorts the next draft even when the given draft is not sorted", () => {
    expect(togglePosition([4, 1], 2, 3).next).toEqual([1, 2, 4]);
    expect(togglePosition([5, 3, 1], 3, 3).next).toEqual([1, 5]);
  });

  it("does not change the draft it is given", () => {
    const draft = [2, 4];
    const { next } = togglePosition(draft, 3, 2);
    expect(draft).toEqual([2, 4]);
    expect(next).not.toBe(draft);
  });
});

describe("organizerDrawerKey", () => {
  it("joins the stable cabinet key and the drawer, which survive undo and restore", () => {
    expect(organizerDrawerKey({ cabinetKey: "cab-3", drawer: "Top" })).toBe("cab-3:Top");
    expect(organizerDrawerKey({ cabinetKey: "cab-12", drawer: "Bot" })).toBe("cab-12:Bot");
  });
});
