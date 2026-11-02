import { describe, expect, it } from "vitest";

import { arePrebuiltModelPresetsEqual } from "../arePrebuiltModelPresetsEqual";

describe("arePrebuiltModelPresetsEqual", () => {
  it("reads an empty string and a missing value as the same, on either side", () => {
    const placed = [{ name: "Sink-Base", Width: 60, LegColor: "" }];
    const catalog = [{ name: "Sink-Base", Width: 60 }];

    expect(arePrebuiltModelPresetsEqual(placed, catalog)).toBe(true);
    expect(arePrebuiltModelPresetsEqual(catalog, placed)).toBe(true);
  });

  it("still tells a value from an empty string", () => {
    const placed = [{ name: "Sink-Base", LegColor: "" }];
    const catalog = [{ name: "Sink-Base", LegColor: "Antracite 400 MT" }];

    expect(arePrebuiltModelPresetsEqual(placed, catalog)).toBe(false);
    expect(arePrebuiltModelPresetsEqual(catalog, placed)).toBe(false);
  });

  it("still tells presets with real differences apart", () => {
    const preset = [{ name: "Sink-Base", Width: 60, Drawers: "2D" }];

    expect(arePrebuiltModelPresetsEqual(preset, [{ name: "Sink-Base", Width: 40, Drawers: "2D" }])).toBe(false);
    expect(arePrebuiltModelPresetsEqual(preset, [{ name: "Sink-Base", Width: 60, Drawers: "1D" }])).toBe(false);
    expect(arePrebuiltModelPresetsEqual(preset, [{ name: "Sink-Cabinet", Width: 60, Drawers: "2D" }])).toBe(false);
    expect(arePrebuiltModelPresetsEqual(preset, [...preset, ...preset])).toBe(false);
  });

  it("keeps 0 a value, not an empty one", () => {
    const zero = [{ name: "Sink-Base", Width: 0 }];

    expect(arePrebuiltModelPresetsEqual(zero, [{ name: "Sink-Base" }])).toBe(false);
    expect(arePrebuiltModelPresetsEqual([{ name: "Sink-Base" }], zero)).toBe(false);
    expect(arePrebuiltModelPresetsEqual(zero, [{ name: "Sink-Base", Width: 0 }])).toBe(true);
  });

  it("leaves out the colours a model takes over from the selection", () => {
    expect(
      arePrebuiltModelPresetsEqual(
        [{ name: "Sink-Base", CabinetColor: "Antracite 400 MT" }],
        [{ name: "Sink-Base", CabinetColor: "Moka 408 MT" }],
      ),
    ).toBe(true);
  });
});
