import { describe, expect, it } from "vitest";

import { parseProductProfile, type ProductProfile } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";

import { parseThicknessValue } from "../parse";
import { canThicknessFloat, findThicknessOption } from "../thicknessCapabilities";

const ulhProfile: ProductProfile = (() => {
  const parsed = parseProductProfile(ulhProfileDocument);
  if (!parsed.ok) throw new Error("The Urban Low Height profile failed validation");
  return parsed.profile;
})();

describe("findThicknessOption", () => {
  it("finds the option by its value or an alias, exactly unless told otherwise", () => {
    expect(findThicknessOption(ulhProfile, 5.125)?.value).toBe("5.125");
    expect(findThicknessOption(ulhProfile, 2.4)?.value).toBe("2.4");
    // The table's 2-3/8 parses as the 2.4 option; a scene top measuring 2⅜″ finds it within the movement tolerance.
    expect(findThicknessOption(ulhProfile, parseThicknessValue("2-3/8") ?? 0)?.value).toBe("2.4");
    expect(findThicknessOption(ulhProfile, 2.375, 0.25)?.value).toBe("2.4");
    expect(findThicknessOption(ulhProfile, 5.1)).toBeNull();
    expect(findThicknessOption(ulhProfile, 3)).toBeNull();
  });

  it("takes the nearest option within the tolerance, not the first", () => {
    // 0.375, 0.4 and 0.5 stand 0.025–0.125″ apart.
    expect(findThicknessOption(ulhProfile, 0.49, 0.25)?.value).toBe("0.5");
    expect(findThicknessOption(ulhProfile, 0.38, 0.25)?.value).toBe("0.375");
    // A 4″ mesh may measure 3.94″.
    expect(findThicknessOption(ulhProfile, 3.94, 0.25)?.value).toBe("4");
  });

  it("finds nothing without a profile", () => {
    expect(findThicknessOption(null, 5.125)).toBeNull();
  });
});

describe("canThicknessFloat", () => {
  it("lets only the tops that lift carry a basin off its Sink Base", () => {
    expect([0.375, 0.4, 0.5, 2.4, 4, 5.125, 5.5].filter((value) => canThicknessFloat(ulhProfile, value))).toEqual([
      5.125, 5.5,
    ]);
  });

  it("lets nothing float in a collection whose options declare no lift", () => {
    expect([0.5, 4, 5.125, 5.5].some((value) => canThicknessFloat(ushProfile, value))).toBe(false);
    expect(canThicknessFloat(null, 5.125)).toBe(false);
  });
});
