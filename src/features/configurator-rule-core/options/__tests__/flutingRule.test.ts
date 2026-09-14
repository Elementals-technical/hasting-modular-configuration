import { describe, expect, it } from "vitest";

import { flutingRule } from "../rules/flutingRule";

/**
 * Current behaviour of the fluting rule, recorded before its parameters move into the
 * collection profile. The same expectations must hold once the rule reads USH data.
 */

describe("flutingRule", () => {
  it.each(["LACM", " lacquer matte ", "Lacquered Matte", "LACQUERED MT", "lacquer mt"])(
    "offers every fluting option for Lacquer Matte spelled %j",
    (material) => {
      const result = flutingRule({ targetPart: "CABINET", material });

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
    expect(flutingRule({ targetPart: "CABINET", material })).toEqual({
      available: false,
      options: [],
      reason: "Fluting is available only for Lacquer Matte (LACM).",
    });
  });

  it("is unavailable for side panels even on Lacquer Matte", () => {
    expect(flutingRule({ targetPart: "SIDE_PANEL", material: "LACM" })).toEqual({
      available: false,
      options: [],
      reason: "Fluting is not available for side panels.",
    });
  });
});
