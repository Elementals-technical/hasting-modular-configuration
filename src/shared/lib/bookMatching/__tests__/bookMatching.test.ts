import { describe, expect, it } from "vitest";

import type { BookMatchingRuleData, ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";

import { deriveBookMatchingAvailability, deriveBookMatchingChargeInfo } from "../index";

/**
 * Book matching on the USH profile must behave as the constants it replaced did; another
 * profile changes the result without code.
 */

const SELECT_GRAIN_REASON = "Select grain direction first.";
const HORIZONTAL_GRAIN_REASON = "Horizontal grain requires at least 2 adjacent drawer cabinets.";
const VERTICAL_GRAIN_REASON = "Vertical book matching is only available for 2 drawer cabinet styles.";

const USH_BOOK_MATCHING = ushProfile.ruleData.bookMatching as BookMatchingRuleData;

const withBookMatching = (bookMatching: BookMatchingRuleData | undefined): ProductProfile => ({
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, bookMatching },
});

const availability = (
  grainDirection: string | null,
  cabinets: { name: string; drawers: string | null }[],
  profile: ProductProfile | null = ushProfile,
) => deriveBookMatchingAvailability({ grainDirection, cabinets, profile });

describe("deriveBookMatchingAvailability on the USH profile", () => {
  it.each([[null], [""], ["Diagonal"]])("asks for a grain direction when it is %j", (grainDirection) => {
    expect(availability(grainDirection, [{ name: "Sink-Base-80", drawers: "2" }])).toEqual({
      available: false,
      reason: SELECT_GRAIN_REASON,
      reasonCode: "grain.selectDirection",
      direction: null,
    });
  });

  describe("vertical grain", () => {
    it("is available when every drawer cabinet has two drawers", () => {
      expect(
        availability("GrainVertical", [
          { name: "Sink-Base-80", drawers: "2" },
          { name: "Side-Cabinet-40", drawers: "2D" },
          // Open cabinets are not drawer cabinets, so their drawer value is ignored.
          { name: "Open-Shelf-40", drawers: "1" },
        ]),
      ).toEqual({ available: true, direction: "V" });
    });

    it.each(["1", "1D", "1DW", "1+inner", "1DWID"])("is unavailable when a drawer cabinet has %j", (drawers) => {
      expect(
        availability("GrainVertical", [
          { name: "Sink-Base-80", drawers: "2" },
          { name: "Sink-Cabinet-60", drawers },
        ]),
      ).toEqual({
        available: false,
        reason: VERTICAL_GRAIN_REASON,
        reasonCode: "grain.verticalRequiresTwoDrawers",
        direction: "V",
      });
    });
  });

  describe("horizontal grain", () => {
    it.each([
      ["runtime names", ["Sink-Base-80", "Side-Cabinet-40"]],
      ["short codes", ["SB", "SC"]],
      ["spaced names", ["Sink Base", "side_cabinet"]],
    ])("is available for two adjacent drawer cabinets given as %s", (_label, names) => {
      expect(
        availability(
          "GrainHorizontal",
          names.map((name) => ({ name, drawers: "1" })),
        ),
      ).toEqual({ available: true, direction: "H" });
    });

    it.each([
      ["an open shelf between them", ["Sink-Base-80", "Open-Shelf-40", "Sink-Cabinet-60"]],
      ["a side shelf between them", ["SB", "OSS", "SC"]],
      ["a single drawer cabinet", ["Sink-Base-80"]],
      ["an unknown cabinet between them", ["Sink-Base-80", "Mirror", "Sink-Cabinet-60"]],
    ])("is unavailable with %s", (_label, names) => {
      expect(
        availability(
          "GrainHorizontal",
          names.map((name) => ({ name, drawers: "2" })),
        ),
      ).toEqual({
        available: false,
        reason: HORIZONTAL_GRAIN_REASON,
        reasonCode: "grain.horizontalNeedsAdjacentCabinets",
        direction: "H",
      });
    });
  });
});

describe("deriveBookMatchingAvailability on other data", () => {
  it("follows the adjacent-cabinet minimum the collection declares", () => {
    const profile = withBookMatching({ ...USH_BOOK_MATCHING, horizontalMinimumAdjacentDrawerCabinets: 3 });
    const two = [
      { name: "SB", drawers: "1" },
      { name: "SC", drawers: "1" },
    ];

    expect(availability("GrainHorizontal", two, profile)).toMatchObject({
      available: false,
      reason: "Horizontal grain requires at least 3 adjacent drawer cabinets.",
    });
    expect(availability("GrainHorizontal", [...two, { name: "SB", drawers: "1" }], profile).available).toBe(true);
  });

  it("follows the drawer styles the collection allows for vertical matching", () => {
    const profile = withBookMatching({ ...USH_BOOK_MATCHING, verticalAllowedDrawerStyles: ["1", "2"] });

    expect(availability("GrainVertical", [{ name: "SB", drawers: "1D" }], profile).available).toBe(true);
    expect(availability("GrainVertical", [{ name: "SB", drawers: "1+inner" }], profile).available).toBe(false);
  });

  it("is not offered by a collection without the section", () => {
    expect(availability("GrainVertical", [{ name: "SB", drawers: "2" }], withBookMatching(undefined))).toEqual({
      available: false,
      reason: "Book matching is not available in this collection.",
      reasonCode: "bookMatching.notInCollection",
      direction: "V",
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
      profile: ushProfile,
    });

    expect(info).toMatchObject({ available: true, eligibleCabinetCount: 2, drawerQty: 3, applies: true });
  });

  it("reports the reason and charges nothing when unavailable", () => {
    const info = deriveBookMatchingChargeInfo({
      grainDirection: null,
      bookMatching: "enabled",
      cabinets: [{ name: "SB", drawers: "2" }],
      profile: ushProfile,
    });

    expect(info).toMatchObject({ available: false, reason: SELECT_GRAIN_REASON, drawerQty: 0, applies: false });
  });

  it("charges nothing in a collection without book matching", () => {
    const info = deriveBookMatchingChargeInfo({
      grainDirection: "GrainVertical",
      bookMatching: "enabled",
      cabinets: [{ name: "SB", drawers: "2" }],
      profile: withBookMatching(undefined),
    });

    expect(info).toMatchObject({ available: false, eligibleCabinetCount: 0, drawerQty: 0, applies: false });
  });
});
