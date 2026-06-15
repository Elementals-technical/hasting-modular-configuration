import { describe, expect, it } from "vitest";

import { resolveMaxResizableCabinetWidthCm } from "../lengthLimits";

describe("resolveMaxResizableCabinetWidthCm", () => {
  it("allows resizing a single Syntesi-compatible cabinet up to the total max", () => {
    expect(
      resolveMaxResizableCabinetWidthCm({
        maxCm: 120,
        currentTotalCm: 60,
        currentCabinetWidthCm: 60,
      }),
    ).toBe(120);
  });

  it("subtracts only the other cabinets when resizing one cabinet in a composition", () => {
    expect(
      resolveMaxResizableCabinetWidthCm({
        maxCm: 120,
        currentTotalCm: 100,
        currentCabinetWidthCm: 40,
      }),
    ).toBe(60);
  });

  it.each([
    { maxCm: null, currentTotalCm: 60, currentCabinetWidthCm: 60 },
    { maxCm: 120, currentTotalCm: null, currentCabinetWidthCm: 60 },
    { maxCm: 120, currentTotalCm: 60, currentCabinetWidthCm: null },
    { maxCm: Number.POSITIVE_INFINITY, currentTotalCm: 60, currentCabinetWidthCm: 60 },
  ])("returns null when the resize limit cannot be evaluated from %j", (input) => {
    expect(resolveMaxResizableCabinetWidthCm(input)).toBeNull();
  });
});
