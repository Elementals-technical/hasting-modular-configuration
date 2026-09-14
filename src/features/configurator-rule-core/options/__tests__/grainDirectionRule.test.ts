import { describe, expect, it } from "vitest";

import { grainDirectionRule } from "../rules/grainDirectionRule";

/**
 * Current behaviour of the grain direction rule, recorded before its parameters move
 * into the collection profile. The same expectations must hold once the rule reads USH data.
 */

const HPL_REASON =
  "Grain direction is not available for HPL material finishes: TKP, TKQ, TKN (Cepp Stone, Rox Black, Brera Brown).";
const THREE_D_REASON =
  "Grain direction is not available for 3D material finishes: 10B, 10F, 1A1, 1A2, 1A3, 1A4, 1A5, 1PE (Colortech Bianco, Colortech Grigio fume, Cemento Cenere, Cemento Tortora, Cemento Creta, Cemento Oltremare, Cemento Ghiaccio, Pelle Pecari Tortora).";

describe("grainDirectionRule", () => {
  it.each([
    ["Essenze", null],
    ["HPL", "TKF"],
    ["3D", "10A"],
    [" HPL ", undefined],
  ])("offers both directions for %j with finish %j", (material, finish) => {
    const result = grainDirectionRule({ material, finish });

    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.options).toEqual([
      { value: "GrainHorizontal", label: "Horizontal", enabled: true },
      { value: "GrainVertical", label: "Vertical", enabled: true },
    ]);
  });

  it.each([[""], [null], [undefined], ["   "]])("asks for an eligible material when it is %j", (material) => {
    expect(grainDirectionRule({ material })).toEqual({
      available: false,
      options: [],
      reason: "Grain direction is only available for Essenze, HPL, and 3D materials.",
    });
  });

  it.each([["Lacquer Matte"], ["hpl"], ["Essence"]])("is unavailable for material %j", (material) => {
    expect(grainDirectionRule({ material, finish: "TKF" })).toEqual({
      available: false,
      options: [],
      reason: "Grain direction is available only for Essenze, HPL, and 3D materials.",
    });
  });

  it.each(["TKP", "TKQ", " TKN "])("is unavailable for the HPL finish %j", (finish) => {
    expect(grainDirectionRule({ material: "HPL", finish })).toEqual({
      available: false,
      options: [],
      reason: HPL_REASON,
    });
  });

  it.each(["10B", "10F", "1A1", "1A5", "1PE"])("is unavailable for the 3D finish %j", (finish) => {
    expect(grainDirectionRule({ material: "3D", finish })).toEqual({
      available: false,
      options: [],
      reason: THREE_D_REASON,
    });
  });

  it("does not apply an HPL exclusion to another material", () => {
    expect(grainDirectionRule({ material: "Essenze", finish: "TKP" }).available).toBe(true);
  });
});
