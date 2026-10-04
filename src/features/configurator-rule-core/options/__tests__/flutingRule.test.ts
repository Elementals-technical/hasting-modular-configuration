import { describe, expect, it } from "vitest";

import type { FlutingRuleData, ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";

import { flutingRule } from "../rules/flutingRule";

/**
 * The fluting rule on the USH profile must behave as the constants it replaced did; another
 * profile changes the result without code.
 */

const withFluting = (fluting: FlutingRuleData | undefined): ProductProfile => ({
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, fluting },
});

describe("flutingRule on the USH profile", () => {
  it.each(["LACM", " lacquer matte ", "Lacquered Matte", "LACQUERED MT", "lacquer mt"])(
    "offers every fluting option for Lacquer Matte spelled %j",
    (material) => {
      const result = flutingRule({ targetPart: "CABINET", material }, ushProfile);

      expect(result.available).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.options.map((option) => option.value)).toEqual([
        "None",
        "FlutingVerticalA",
        "FlutingVerticalB",
        "FlutingHorizontalA",
        "FlutingHorizontalB",
      ]);
      expect(result.options.every((option) => option.enabled)).toBe(true);
    },
  );

  it.each([["HPL"], ["Lacquer Gloss"], [""], [null], [undefined]])("is unavailable for material %j", (material) => {
    expect(flutingRule({ targetPart: "CABINET", material }, ushProfile)).toEqual({
      available: false,
      options: [],
      reason: "Fluting is available only for Lacquer Matte (LACM).",
      reasonCode: "fluting.requiresLacquerMatte",
    });
  });

  it("is unavailable for side panels even on Lacquer Matte", () => {
    expect(flutingRule({ targetPart: "SIDE_PANEL", material: "LACM" }, ushProfile)).toEqual({
      available: false,
      options: [],
      reason: "Fluting is not available for side panels.",
      reasonCode: "fluting.sidePanelUnavailable",
    });
  });
});

describe("flutingRule on other data", () => {
  it("follows the materials and parts the collection declares", () => {
    const profile = withFluting({ eligibleMaterialAliases: ["HPL"], forbiddenTargetParts: [] });

    expect(flutingRule({ targetPart: "CABINET", material: "hpl" }, profile).available).toBe(true);
    expect(flutingRule({ targetPart: "SIDE_PANEL", material: "HPL" }, profile).available).toBe(true);
    expect(flutingRule({ targetPart: "CABINET", material: "LACM" }, profile).available).toBe(false);
  });

  it("is not offered by a collection without the section", () => {
    expect(flutingRule({ targetPart: "CABINET", material: "LACM" }, withFluting(undefined))).toEqual({
      available: false,
      options: [],
      reason: "Fluting is not available in this collection.",
      reasonCode: "fluting.notInCollection",
    });
  });

  it("is unavailable while no collection is loaded", () => {
    expect(flutingRule({ targetPart: "CABINET", material: "LACM" }, null)).toMatchObject({
      available: false,
      reasonCode: "fluting.notInCollection",
    });
  });
});
