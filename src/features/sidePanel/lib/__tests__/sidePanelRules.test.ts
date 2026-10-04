import { describe, expect, it } from "vitest";

import type { ProductProfile, SidePanelsRuleData } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";

import { mapCabinetTypeToGroup } from "../../model/selectors";
import { formatSidePanelLength340Reason, isSidePanelLengthBlocked } from "../sidePanelReasons";
import {
  mapSidePanelDrawersToHandleType,
  sidePanelAvailabilityRule,
  sidePanelCountertopLengthRule,
  sidePanelSpecRule,
  syntesiSidePanelRule,
} from "../sidePanelRules";

/**
 * The side panel rules on the USH profile must behave as the constants they replaced did;
 * another profile changes the result without code.
 */

const USH_SIDE_PANELS = ushProfile.ruleData.sidePanels as SidePanelsRuleData;

const withSidePanels = (sidePanels: SidePanelsRuleData | undefined): ProductProfile => ({
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, sidePanels },
});

const allowed = (height: number, handleType: "1D" | "2D" | null, profile: ProductProfile = ushProfile) =>
  Array.from(sidePanelAvailabilityRule({ height, handleType, cabinetType: "SBSC" }, profile).allowed).sort();

describe("sidePanelAvailabilityRule on the USH profile", () => {
  it.each([
    [50, "1D", ["NoG"]],
    [50, "2D", ["NoG"]],
    [53, "1D", ["NoG", "UpperG"]],
    [53, "2D", ["CenterG", "NoG"]],
    [56, "1D", ["NoG"]],
    [56, "2D", ["DoubleG", "NoG"]],
  ] as const)("allows the grooves of the %i cm / %s row", (height, handleType, grooves) => {
    expect(allowed(height, handleType)).toEqual(grooves);
  });

  it("uses the first row of the height when the drawers are unknown", () => {
    expect(allowed(53, null)).toEqual(["NoG", "UpperG"]);
  });

  it.each([[48], [60]])("allows nothing at an unlisted height of %i cm", (height) => {
    expect(sidePanelAvailabilityRule({ height, handleType: "1D", cabinetType: "SBSC" }, ushProfile)).toEqual({
      allowed: new Set(),
    });
  });

  it("allows nothing without a cabinet type", () => {
    expect(sidePanelAvailabilityRule({ height: 53, handleType: "1D", cabinetType: null }, ushProfile)).toEqual({
      allowed: new Set(),
    });
  });

  it.each([
    ["OS", "open-shelf", "sidePanel.openShelfUnavailable", "Side panels are not available for use with Open Shelf cabinets."],
    ["OSS", "side-shelf", "sidePanel.sideShelfUnavailable", "Side panels are not available for Side-Shelf cabinets."],
  ] as const)("blocks %s cabinets with a reason", (cabinetType, reasonCode, messageCode, reason) => {
    expect(sidePanelAvailabilityRule({ height: 53, handleType: "1D", cabinetType }, ushProfile)).toEqual({
      allowed: new Set(),
      reason,
      reasonCode,
      // The interface resolves this code; `reasonCode` groups the blockers for the rules.
      messageCode,
    });
  });
});

describe("side panel groups on the USH profile", () => {
  it.each([
    ["Sink-Base-80x46", "SBSC"],
    ["side-cabinet-40", "SBSC"],
    ["SB", "SBSC"],
    ["sbsc", "SBSC"],
    ["Open-Shelf-40", "OS"],
    ["os", "OS"],
    ["Side-Shelf", "OSS"],
    ["OSS", "OSS"],
    ["Mirror", null],
    [null, null],
  ])("puts %j in the %j group", (cabinetType, group) => {
    expect(mapCabinetTypeToGroup(cabinetType, ushProfile)).toBe(group);
  });

  it.each([
    ["1", "1D"],
    ["1D", "1D"],
    ["1+inner", "1D"],
    ["1DWID", "1D"],
    ["2", "2D"],
    ["2D", "2D"],
    ["2DW", null],
    [null, null],
  ])("puts drawers %j in the %j group", (drawers, group) => {
    expect(mapSidePanelDrawersToHandleType(drawers, ushProfile)).toBe(group);
  });
});

describe("side panel rules on other data", () => {
  it("follows the availability table the collection declares", () => {
    const profile = withSidePanels({
      ...USH_SIDE_PANELS,
      availability: [{ height: "53H", handleType: "1D", cabinetType: "SBSC", allowed: ["DoubleG"] }],
    });

    expect(allowed(53, "1D", profile)).toEqual(["DoubleG"]);
    expect(allowed(56, "2D", profile)).toEqual([]);
  });

  it("follows the cabinet names the collection declares", () => {
    const profile = withSidePanels({ ...USH_SIDE_PANELS, cabinetGroups: { SBSC: ["Vanity-Base"] } });

    expect(mapCabinetTypeToGroup("Vanity-Base-60", profile)).toBe("SBSC");
    expect(mapCabinetTypeToGroup("Sink-Base-60", profile)).toBeNull();
  });

  it("follows the length rules the collection declares", () => {
    const profile = withSidePanels({
      ...USH_SIDE_PANELS,
      exactBlockedCabinetLengthCm: 300,
      countertopLengthIncrementCm: 3,
    });

    expect(isSidePanelLengthBlocked(300, profile)).toBe(true);
    expect(isSidePanelLengthBlocked(340, profile)).toBe(false);
    expect(sidePanelCountertopLengthRule({ sidePanels: "NoG", vanityLength: 160 }, profile)).toEqual({ length: 163 });
  });

  it("is not offered by a collection without the section", () => {
    const profile = withSidePanels(undefined);

    expect(sidePanelAvailabilityRule({ height: 53, handleType: "1D", cabinetType: "SBSC" }, profile)).toEqual({
      allowed: new Set(),
      reason: "Side panels are not available in this collection.",
      reasonCode: "not-in-collection",
      messageCode: "sidePanel.notInCollection",
    });
    expect(mapCabinetTypeToGroup("Sink-Base", profile)).toBeNull();
    expect(isSidePanelLengthBlocked(340, profile)).toBe(false);
    expect(sidePanelSpecRule({ sidePanels: "NoG", cabinetHeight: 53 }, profile)).toEqual({ enabled: false });
  });
});

describe("syntesiSidePanelRule", () => {
  it.each([[null], [""], ["None"]])("allows anything while side panels are %j", (sidePanels) => {
    expect(syntesiSidePanelRule({ sidePanels, countertopMaterial: "Syntesi" }, ushProfile)).toEqual({ allowed: true });
  });

  it("forbids side panels on a Syntesi countertop", () => {
    expect(syntesiSidePanelRule({ sidePanels: "UpperG", countertopMaterial: " Syntesi " }, ushProfile)).toEqual({
      allowed: false,
      reason: "Syntesi is not available with side panels.",
    });
  });

  it("allows side panels on another countertop", () => {
    expect(syntesiSidePanelRule({ sidePanels: "UpperG", countertopMaterial: "Tekorlux" }, ushProfile)).toEqual({
      allowed: true,
    });
  });
});

describe("sidePanelCountertopLengthRule", () => {
  it("adds 2 cm while side panels are on", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "NoG", vanityLength: 160 }, ushProfile)).toEqual({
      length: 162,
    });
  });

  it("keeps the vanity length without side panels", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "None", vanityLength: 160 }, ushProfile)).toEqual({
      length: 160,
    });
  });

  it("has no length without a vanity length", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "NoG", vanityLength: null }, ushProfile)).toEqual({
      length: null,
    });
  });
});

describe("sidePanelSpecRule", () => {
  it("is disabled without side panels", () => {
    expect(sidePanelSpecRule({ sidePanels: "None", cabinetHeight: 53, cabinetDepth: 46 }, ushProfile)).toEqual({
      enabled: false,
    });
  });

  it("uses two panels of the cabinet size", () => {
    expect(
      sidePanelSpecRule({ sidePanels: "NoG", cabinetHeight: 53, cabinetDepth: 46, heightType: "STANDARD" }, ushProfile),
    ).toEqual({ enabled: true, qty: 2, height: 53, depth: 46 });
  });

  it("leaves the quantity open for low panels", () => {
    expect(sidePanelSpecRule({ sidePanels: "NoG", cabinetHeight: null, heightType: "LOW" }, ushProfile)).toEqual({
      enabled: true,
      qty: undefined,
      height: null,
      depth: null,
    });
  });
});

describe("side panel length block on the USH profile", () => {
  it.each([
    [340, true],
    [340.005, true],
    [339.5, false],
    [null, false],
  ])("blocks a cabinet-only length of %j: %j", (length, blocked) => {
    expect(isSidePanelLengthBlocked(length, ushProfile)).toBe(blocked);
  });

  it("explains the block in centimetres and inches", () => {
    expect(formatSidePanelLength340Reason(ushProfile)).toBe(
      'Side panels are not available when total vanity length is exactly 340 cm (133.9").',
    );
  });
});

// Urban Low Height hangs the ULH side panels (sidePanelSupport profile "ulh"): no groove, or the
// upper groove at the heights of the upper-groove handle (product map §2: 38 / 28 cm).
describe("side panel rules on the Urban Low Height profile", () => {
  const parsed = parseProductProfile(ulhProfileDocument);
  if (!parsed.ok) throw new Error("Urban Low Height profile must parse");
  const ulhProfile = parsed.profile;

  it("offers the upper groove at the upper-groove heights and no groove at the push-to-open ones", () => {
    expect(allowed(38, "1D", ulhProfile)).toEqual(["NoG", "UpperG"]);
    expect(allowed(28, "1D", ulhProfile)).toEqual(["NoG", "UpperG"]);
    expect(allowed(35, "1D", ulhProfile)).toEqual(["NoG"]);
    expect(allowed(25, "1D", ulhProfile)).toEqual(["NoG"]);
  });

  it("knows its cabinets by type and by the ULH scene name, and refuses the open shelf", () => {
    expect(mapCabinetTypeToGroup("Sink-Base", ulhProfile)).toBe("SBSC");
    expect(mapCabinetTypeToGroup("ULH-side-cabinet-k3j4h5g6f", ulhProfile)).toBe("SBSC");
    expect(mapCabinetTypeToGroup("ULH-Open-Shelf-k3j4h5g6f", ulhProfile)).toBe("OS");
    expect(mapSidePanelDrawersToHandleType("1D", ulhProfile)).toBe("1D");

    expect(sidePanelAvailabilityRule({ height: 38, handleType: "1D", cabinetType: "OS" }, ulhProfile)).toMatchObject({
      allowed: new Set(),
      reason: "Side panels are not available for use with Open Shelf cabinets.",
    });
  });
});
