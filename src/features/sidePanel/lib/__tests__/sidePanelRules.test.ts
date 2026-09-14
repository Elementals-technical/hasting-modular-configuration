import { describe, expect, it } from "vitest";

import { formatSidePanelLength340Reason, isSidePanelLengthBlocked } from "../sidePanelReasons";
import {
  sidePanelAvailabilityRule,
  sidePanelCountertopLengthRule,
  sidePanelSpecRule,
  syntesiSidePanelRule,
} from "../sidePanelRules";

/**
 * Current behaviour of the side panel rules, recorded before their parameters move into
 * the collection profile. The same expectations must hold once the rules read USH data.
 */

const allowed = (height: number, handleType: "1D" | "2D" | null) =>
  Array.from(sidePanelAvailabilityRule({ height, handleType, cabinetType: "SBSC" }).allowed).sort();

describe("sidePanelAvailabilityRule", () => {
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
    expect(sidePanelAvailabilityRule({ height, handleType: "1D", cabinetType: "SBSC" })).toEqual({
      allowed: new Set(),
    });
  });

  it("allows nothing without a cabinet type", () => {
    expect(sidePanelAvailabilityRule({ height: 53, handleType: "1D", cabinetType: null })).toEqual({
      allowed: new Set(),
    });
  });

  it.each([
    ["OS", "open-shelf", "Side panels are not available for use with Open Shelf cabinets."],
    ["OSS", "side-shelf", "Side panels are not available for Side-Shelf cabinets."],
  ] as const)("blocks %s cabinets with a reason", (cabinetType, reasonCode, reason) => {
    expect(sidePanelAvailabilityRule({ height: 53, handleType: "1D", cabinetType })).toEqual({
      allowed: new Set(),
      reason,
      reasonCode,
    });
  });
});

describe("syntesiSidePanelRule", () => {
  it.each([[null], [""], ["None"]])("allows anything while side panels are %j", (sidePanels) => {
    expect(syntesiSidePanelRule({ sidePanels, countertopMaterial: "Syntesi" })).toEqual({ allowed: true });
  });

  it("forbids side panels on a Syntesi countertop", () => {
    expect(syntesiSidePanelRule({ sidePanels: "UpperG", countertopMaterial: " Syntesi " })).toEqual({
      allowed: false,
      reason: "Syntesi is not available with side panels.",
    });
  });

  it("allows side panels on another countertop", () => {
    expect(syntesiSidePanelRule({ sidePanels: "UpperG", countertopMaterial: "Tekorlux" })).toEqual({ allowed: true });
  });
});

describe("sidePanelCountertopLengthRule", () => {
  it("adds 2 cm while side panels are on", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "NoG", vanityLength: 160 })).toEqual({ length: 162 });
  });

  it("keeps the vanity length without side panels", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "None", vanityLength: 160 })).toEqual({ length: 160 });
  });

  it("has no length without a vanity length", () => {
    expect(sidePanelCountertopLengthRule({ sidePanels: "NoG", vanityLength: null })).toEqual({ length: null });
  });
});

describe("sidePanelSpecRule", () => {
  it("is disabled without side panels", () => {
    expect(sidePanelSpecRule({ sidePanels: "None", cabinetHeight: 53, cabinetDepth: 46 })).toEqual({ enabled: false });
  });

  it("uses two panels of the cabinet size", () => {
    expect(
      sidePanelSpecRule({ sidePanels: "NoG", cabinetHeight: 53, cabinetDepth: 46, heightType: "STANDARD" }),
    ).toEqual({ enabled: true, qty: 2, height: 53, depth: 46 });
  });

  it("leaves the quantity open for low panels", () => {
    expect(sidePanelSpecRule({ sidePanels: "NoG", cabinetHeight: null, heightType: "LOW" })).toEqual({
      enabled: true,
      qty: undefined,
      height: null,
      depth: null,
    });
  });
});

describe("side panel length block", () => {
  it.each([
    [340, true],
    [340.005, true],
    [339.5, false],
    [null, false],
  ])("blocks a cabinet-only length of %j: %j", (length, blocked) => {
    expect(isSidePanelLengthBlocked(length)).toBe(blocked);
  });

  it("explains the block in centimetres and inches", () => {
    expect(formatSidePanelLength340Reason()).toBe(
      'Side panels are not available when total vanity length is exactly 340 cm (133.9").',
    );
  });
});
