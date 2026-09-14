import { describe, expect, it } from "vitest";

import type { GrainDirectionRuleData, ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";

import { grainDirectionRule } from "../rules/grainDirectionRule";

/**
 * The grain direction rule on the USH profile must behave as the constants it replaced did;
 * another profile changes the result without code.
 */

const HPL_REASON =
  "Grain direction is not available for HPL material finishes: TKP, TKQ, TKN (Cepp Stone, Rox Black, Brera Brown).";
const THREE_D_REASON =
  "Grain direction is not available for 3D material finishes: 10B, 10F, 1A1, 1A2, 1A3, 1A4, 1A5, 1PE (Colortech Bianco, Colortech Grigio fume, Cemento Cenere, Cemento Tortora, Cemento Creta, Cemento Oltremare, Cemento Ghiaccio, Pelle Pecari Tortora).";

const withGrain = (grainDirection: GrainDirectionRuleData | undefined): ProductProfile => ({
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, grainDirection },
});

const unavailable = (reason: string, reasonCode: string) => ({ available: false, options: [], reason, reasonCode });

describe("grainDirectionRule on the USH profile", () => {
  it.each([
    ["Essenze", null],
    ["HPL", "TKF"],
    ["3D", "10A"],
    [" HPL ", undefined],
  ])("offers both directions for %j with finish %j", (material, finish) => {
    const result = grainDirectionRule({ material, finish }, ushProfile);

    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.options).toEqual([
      { value: "GrainHorizontal", label: "Horizontal", enabled: true },
      { value: "GrainVertical", label: "Vertical", enabled: true },
    ]);
  });

  it.each([[""], [null], [undefined], ["   "]])("asks for an eligible material when it is %j", (material) => {
    expect(grainDirectionRule({ material }, ushProfile)).toEqual(
      unavailable(
        "Grain direction is only available for Essenze, HPL, and 3D materials.",
        "grain.requiresEligibleMaterial",
      ),
    );
  });

  it.each([["Lacquer Matte"], ["hpl"], ["Essence"]])("is unavailable for material %j", (material) => {
    expect(grainDirectionRule({ material, finish: "TKF" }, ushProfile)).toEqual(
      unavailable("Grain direction is available only for Essenze, HPL, and 3D materials.", "grain.materialNotEligible"),
    );
  });

  it.each(["TKP", "TKQ", " TKN "])("is unavailable for the HPL finish %j", (finish) => {
    expect(grainDirectionRule({ material: "HPL", finish }, ushProfile)).toEqual(
      unavailable(HPL_REASON, "grain.finishExcluded"),
    );
  });

  it.each(["10B", "10F", "1A1", "1A5", "1PE"])("is unavailable for the 3D finish %j", (finish) => {
    expect(grainDirectionRule({ material: "3D", finish }, ushProfile)).toEqual(
      unavailable(THREE_D_REASON, "grain.finishExcluded"),
    );
  });

  it("does not apply an HPL exclusion to another material", () => {
    expect(grainDirectionRule({ material: "Essenze", finish: "TKP" }, ushProfile).available).toBe(true);
  });
});

describe("grainDirectionRule on other data", () => {
  it("follows the materials and exclusions the collection declares", () => {
    const profile = withGrain({ eligibleMaterials: ["Oak"], excludedFinishesByMaterial: { Oak: ["X1", "X2"] } });

    expect(grainDirectionRule({ material: "Oak", finish: "X3" }, profile).available).toBe(true);
    expect(grainDirectionRule({ material: "Essenze" }, profile).reason).toBe(
      "Grain direction is available only for Oak materials.",
    );
    // Without a readable label the codes themselves are listed.
    expect(grainDirectionRule({ material: "Oak", finish: "X2" }, profile).reason).toBe(
      "Grain direction is not available for Oak material finishes: X1, X2.",
    );
  });

  it("is not offered by a collection without the section", () => {
    expect(grainDirectionRule({ material: "Essenze" }, withGrain(undefined))).toEqual(
      unavailable("Grain direction is not available in this collection.", "grain.notInCollection"),
    );
  });
});
