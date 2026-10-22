import { describe, expect, it } from "vitest";

import { overlaps, within } from "../lib/screenGeometry";

const BOX = { left: 10, top: 20, right: 50, bottom: 60 };

describe("screen geometry", () => {
  it("keeps a value within its range, the minimum winning an empty range", () => {
    expect([within(5, 0, 10), within(-3, 0, 10), within(12, 0, 10), within(5, 8, 2)]).toEqual([5, 0, 10, 8]);
  });

  it("finds boxes that share an area", () => {
    expect(overlaps(BOX, { left: 40, top: 50, right: 70, bottom: 80 })).toBe(true);
    expect(overlaps(BOX, { left: 20, top: 30, right: 30, bottom: 40 })).toBe(true);
  });

  it("does not count boxes that only touch or stand apart", () => {
    expect(overlaps(BOX, { left: 50, top: 20, right: 70, bottom: 60 })).toBe(false);
    expect(overlaps(BOX, { left: 10, top: 60, right: 50, bottom: 80 })).toBe(false);
    expect(overlaps(BOX, { left: 100, top: 100, right: 120, bottom: 120 })).toBe(false);
  });
});
