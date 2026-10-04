import { describe, expect, it } from "vitest";

import {
  normalizeRuntimeProductType,
  resolveRuntimeProductType,
  withRuntimeProductType,
} from "../resolveRuntimeProductType";

describe("resolveRuntimeProductType", () => {
  it("reads the Urban product type from a scene id, whatever tail it carries", () => {
    expect(resolveRuntimeProductType("Sink-Base-k3j4h5g6f")).toBe("Sink-Base");
    expect(resolveRuntimeProductType("Sink-Cabinet-a1b2c3d4e")).toBe("Sink-Cabinet");
    expect(resolveRuntimeProductType("Open-Shelf-9x8y7z6w5")).toBe("Open-Shelf");
    expect(resolveRuntimeProductType("Side-Shelf-abcdefghi")).toBe("Side-Shelf");
    // Ids the tests and the fixtures give.
    expect(resolveRuntimeProductType("Sink-Base-new-1")).toBe("Sink-Base");
    expect(resolveRuntimeProductType("Sink-Base-9")).toBe("Sink-Base");
  });

  it("keeps the Urban aliases", () => {
    expect(normalizeRuntimeProductType("Side-Cabinet")).toBe("Sink-Cabinet");
    expect(normalizeRuntimeProductType("SB")).toBe("Sink-Base");
    expect(normalizeRuntimeProductType("sink_base")).toBe("Sink-Base");
  });

  it("keeps the scene type of another collection instead of reading an Urban alias inside it", () => {
    expect(resolveRuntimeProductType("Mako-sink-cabinet-k3j4h5g6f")).toBe("Mako-sink-cabinet");
    expect(resolveRuntimeProductType("Mako-side-cabinet-a1b2c3d4e")).toBe("Mako-side-cabinet");
    expect(resolveRuntimeProductType("Class-sink-cabinet-z9y8x7w6v")).toBe("Class-sink-cabinet");
    expect(resolveRuntimeProductType("ULH-sink-cabinet-1q2w3e4r5")).toBe("ULH-sink-cabinet");
    // The last word of a type is not a random tail.
    expect(normalizeRuntimeProductType("Mako-sink-cabinet")).toBe("Mako-sink-cabinet");
  });

  it("reads the type from the config when the id has a tail without a digit", () => {
    expect(resolveRuntimeProductType("Mako-side-cabinet-abcdefghi", { entityName: "Mako-side-cabinet" })).toBe(
      "Mako-side-cabinet",
    );
  });

  it("names the product type in the config it is placed with", () => {
    expect(withRuntimeProductType({ Width: 60 }, "Mako-sink-cabinet")).toEqual({
      Width: 60,
      ProductType: "Mako-sink-cabinet",
      productType: "Mako-sink-cabinet",
    });
  });
});
