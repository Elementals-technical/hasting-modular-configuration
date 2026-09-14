import { describe, expect, it } from "vitest";

import { deriveBookMatchingAvailability, deriveBookMatchingChargeInfo } from "../index";

/**
 * Current behaviour of book matching availability, recorded before its parameters move
 * into the collection profile. The same expectations must hold once the rule reads USH data.
 */

const SELECT_GRAIN_REASON = "Select grain direction first.";
const HORIZONTAL_GRAIN_REASON = "Horizontal grain requires at least 2 adjacent drawer cabinets.";
const VERTICAL_GRAIN_REASON = "Vertical book matching is only available for 2 drawer cabinet styles.";

describe("deriveBookMatchingAvailability", () => {
  it.each([[null], [""], ["Diagonal"]])("asks for a grain direction when it is %j", (grainDirection) => {
    expect(
      deriveBookMatchingAvailability({ grainDirection, cabinets: [{ name: "Sink-Base-80", drawers: "2" }] }),
    ).toEqual({ available: false, reason: SELECT_GRAIN_REASON, direction: null });
  });

  describe("vertical grain", () => {
    it("is available when every drawer cabinet has two drawers", () => {
      expect(
        deriveBookMatchingAvailability({
          grainDirection: "GrainVertical",
          cabinets: [
            { name: "Sink-Base-80", drawers: "2" },
            { name: "Side-Cabinet-40", drawers: "2D" },
            // Open cabinets are not drawer cabinets, so their drawer value is ignored.
            { name: "Open-Shelf-40", drawers: "1" },
          ],
        }),
      ).toEqual({ available: true, direction: "V" });
    });

    it.each(["1", "1D", "1DW", "1+inner", "1DWID"])("is unavailable when a drawer cabinet has %j", (drawers) => {
      expect(
        deriveBookMatchingAvailability({
          grainDirection: "GrainVertical",
          cabinets: [
            { name: "Sink-Base-80", drawers: "2" },
            { name: "Sink-Cabinet-60", drawers },
          ],
        }),
      ).toEqual({ available: false, reason: VERTICAL_GRAIN_REASON, direction: "V" });
    });
  });

  describe("horizontal grain", () => {
    it.each([
      ["runtime names", ["Sink-Base-80", "Side-Cabinet-40"]],
      ["short codes", ["SB", "SC"]],
      ["spaced names", ["Sink Base", "side_cabinet"]],
    ])("is available for two adjacent drawer cabinets given as %s", (_label, names) => {
      expect(
        deriveBookMatchingAvailability({
          grainDirection: "GrainHorizontal",
          cabinets: names.map((name) => ({ name, drawers: "1" })),
        }),
      ).toEqual({ available: true, direction: "H" });
    });

    it.each([
      ["an open shelf between them", ["Sink-Base-80", "Open-Shelf-40", "Sink-Cabinet-60"]],
      ["a side shelf between them", ["SB", "OSS", "SC"]],
      ["a single drawer cabinet", ["Sink-Base-80"]],
      ["an unknown cabinet between them", ["Sink-Base-80", "Mirror", "Sink-Cabinet-60"]],
    ])("is unavailable with %s", (_label, names) => {
      expect(
        deriveBookMatchingAvailability({
          grainDirection: "GrainHorizontal",
          cabinets: names.map((name) => ({ name, drawers: "2" })),
        }),
      ).toEqual({ available: false, reason: HORIZONTAL_GRAIN_REASON, direction: "H" });
    });
  });
});

describe("deriveBookMatchingChargeInfo", () => {
  it("charges only contiguous groups of at least two drawer cabinets for horizontal grain", () => {
    const info = deriveBookMatchingChargeInfo({
      grainDirection: "GrainHorizontal",
      bookMatching: "enabled",
      materialSku: "ESS",
      cabinets: [
        { name: "SB", drawers: "2" },
        { name: "SC", drawers: "1" },
        { name: "OS", drawers: null },
        { name: "SB", drawers: "2" },
      ],
    });

    expect(info).toMatchObject({ available: true, eligibleCabinetCount: 2, drawerQty: 3, applies: true });
  });

  it("reports the generic reason and charges nothing when unavailable", () => {
    const info = deriveBookMatchingChargeInfo({
      grainDirection: null,
      bookMatching: "enabled",
      cabinets: [{ name: "SB", drawers: "2" }],
    });

    expect(info).toMatchObject({ available: false, reason: SELECT_GRAIN_REASON, drawerQty: 0, applies: false });
  });
});
