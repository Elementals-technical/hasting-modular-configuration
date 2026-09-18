import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import fixtureRulesProfileDocument from "@/entities/collection/__tests__/fixtures/collections/fixture-rules/product-profile.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";

import { LEGACY_MATERIAL_ALIASES, getMaterialAliases, materialMatchesRule, selectMaterialAliasTable } from "../parse";

/**
 * DEV-06: countertop rules read material aliases from the collection's
 * `ruleData.materialNormalization`. Pages and pricing still call the helpers without a
 * profile, so they fall back to the legacy table; while that lasts the two must stay equal.
 */

const parsedFixture = parseProductProfile(fixtureRulesProfileDocument);
const profileWithoutAliases = parsedFixture.ok ? parsedFixture.profile : null;

describe("material aliases", () => {
  it("keeps the legacy table equal to the USH profile until every caller passes the profile", () => {
    expect(ushProfile.ruleData.materialNormalization?.aliases).toEqual(LEGACY_MATERIAL_ALIASES);
  });

  it("reads the collection's table, and the legacy one only when the collection declares none", () => {
    expect(selectMaterialAliasTable(ushProfile)).toBe(ushProfile.ruleData.materialNormalization?.aliases);
    expect(profileWithoutAliases?.ruleData.materialNormalization).toBeUndefined();
    expect(selectMaterialAliasTable(profileWithoutAliases)).toBe(LEGACY_MATERIAL_ALIASES);
    expect(selectMaterialAliasTable(null)).toBe(LEGACY_MATERIAL_ALIASES);
  });

  it("matches a material by the table it is given", () => {
    const table = { acme: ["acmestone"] };

    expect(getMaterialAliases("ACME", table)).toEqual(["acme", "acmestone"]);
    expect(materialMatchesRule("Acme", "AcmeStone", table)).toBe(true);
    // Without the collection's table the legacy one does not know the material.
    expect(materialMatchesRule("Acme", "AcmeStone")).toBe(false);
    expect(materialMatchesRule("SSTKR", "Tekorlux")).toBe(true);
  });
});
