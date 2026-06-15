import { describe, expect, it } from "vitest";

import { calcTotalCountertopWidthCm } from "../calcCountertopWidth";

describe("calcTotalCountertopWidthCm", () => {
  it.each([
    ["none", "none", 60],
    ["active", "none", 61],
    ["none", "active", 61],
    ["active", "active", 62],
    ["auto-removed", "active", 61],
    ["active", "auto-removed", 61],
    ["auto-removed", "auto-removed", 60],
  ])("returns expected width for left=%s and right=%s", (leftStatus, rightStatus, expectedWidth) => {
    expect(calcTotalCountertopWidthCm(60, leftStatus, rightStatus)).toBe(expectedWidth);
  });

  it("returns null when cabinet width and side-panel offset are both empty", () => {
    expect(calcTotalCountertopWidthCm(0, "none", "auto-removed")).toBeNull();
  });
});
