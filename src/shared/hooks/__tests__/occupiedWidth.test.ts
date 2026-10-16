import { describe, expect, it } from "vitest";

import { occupiedWidthCm } from "../useSceneTotalWidth";

describe("occupiedWidthCm", () => {
  it("is the sum of the widths for one row", () => {
    // 0.5 mm apart, as the scene lays a row out.
    expect(
      occupiedWidthCm([
        { widthCm: 70, centreXM: 0.35 },
        { widthCm: 35, centreXM: 0.8755 },
        { widthCm: 60, centreXM: 1.3935 },
      ]),
    ).toBe(165);
  });

  it("counts a column, one cabinet over another, once", () => {
    expect(
      occupiedWidthCm([
        { widthCm: 70, centreXM: 0.35 },
        { widthCm: 70, centreXM: 0.35 },
        { widthCm: 35, centreXM: 0.8755 },
      ]),
    ).toBe(105);
  });

  it("adds what a shifted bottom sticks out", () => {
    // A 70 sink hanging at 0..70 over a 90 side cabinet shifted to 45..135.
    expect(
      occupiedWidthCm([
        { widthCm: 70, centreXM: 0.35 },
        { widthCm: 90, centreXM: 0.9 },
      ]),
    ).toBe(135);
  });

  it("counts touching cabinets apart", () => {
    expect(
      occupiedWidthCm([
        { widthCm: 60, centreXM: 0.3 },
        { widthCm: 60, centreXM: 0.9 },
      ]),
    ).toBe(120);
  });

  it("sums the widths while the scene names no position", () => {
    expect(
      occupiedWidthCm([
        { widthCm: 70, centreXM: null },
        { widthCm: 70, centreXM: 0.35 },
      ]),
    ).toBe(140);
    expect(occupiedWidthCm([])).toBe(0);
  });
});
