import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import type { ProductProfile } from "@/entities/collection";

import { resolveColorTraits, selectConfiguratorSection } from "../lib/resolveColorTraits";
import { configuratorColors } from "./configuratorColorsFixture";

describe("resolveColorTraits", () => {
  it("reads the material from the variant SKU", () => {
    expect(resolveColorTraits("Rovere Naturale", configuratorColors, ushProfile)).toEqual({
      material: "Essenze",
      finish: "",
    });
    expect(resolveColorTraits("Bianco LACM", configuratorColors, ushProfile)?.material).toBe("LACM");
  });

  it("falls back to a known material among the option labels and finds the finish code in the name", () => {
    expect(resolveColorTraits("Cepp Stone TKP", configuratorColors, ushProfile)).toEqual({
      material: "HPL",
      finish: "TKP",
    });
  });

  it("reads nothing for a colour the configurator does not offer, or no longer enables", () => {
    expect(resolveColorTraits("Unknown Colour", configuratorColors, ushProfile)).toEqual({ material: "", finish: "" });
    expect(resolveColorTraits("Retired Oak", configuratorColors, ushProfile)).toEqual({ material: "", finish: "" });
  });

  it("cannot read a colour without the collection's traits or its configurator", () => {
    const withoutTraits: ProductProfile = {
      ...ushProfile,
      ruleData: { ...ushProfile.ruleData, cabinetColorTraits: undefined },
    };

    expect(resolveColorTraits("Rovere Naturale", configuratorColors, withoutTraits)).toBeNull();
    expect(resolveColorTraits("Rovere Naturale", null, ushProfile)).toBeNull();
  });

  it("finds the configurator section an attribute's options come from", () => {
    expect(selectConfiguratorSection(ushProfile, "CabinetColor")).toBe("Cabinet Color");
    expect(selectConfiguratorSection(ushProfile, "DrawerPanelFluting")).toBeNull();
  });
});

describe("ruleData.cabinetColorTraits", () => {
  it("is read from the USH profile", () => {
    expect(ushProfile.ruleData.cabinetColorTraits?.materialBySku.ESS).toBe("Essenze");
    expect(ushProfile.ruleData.cabinetColorTraits?.finishCodes).toContain("1A5");
  });

  it("reports a broken field with its data path", () => {
    const raw: { ruleData: Record<string, unknown> } = JSON.parse(JSON.stringify(ushProfile));
    raw.ruleData.cabinetColorTraits = { materialBySku: ["ESS"], knownMaterials: [], finishCodes: [] };

    const result = parseProductProfile(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ruleData.invalid_section",
        dataPath: "/ruleData/cabinetColorTraits/materialBySku",
      }),
    );
  });
});
