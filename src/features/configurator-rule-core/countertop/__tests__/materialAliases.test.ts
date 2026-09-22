import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import fixtureRulesProfileDocument from "@/entities/collection/__tests__/fixtures/collections/fixture-rules/product-profile.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";

import { selectMaterialHierarchy } from "@/entities/collection";
import { LEGACY_MATERIAL_HIERARCHY, groupMaterialsHierarchically } from "@/shared/constants/materialFilters";

import {
  LEGACY_MATERIAL_ALIASES,
  LEGACY_VESSEL_COMPATIBLE_COUNTERTOP_MATERIAL_TOKENS,
  getMaterialAliases,
  isVesselCompatibleCountertopMaterial,
  materialMatchesRule,
  selectMaterialAliasTable,
} from "../parse";

/**
 * DEV-06: countertop rules read material aliases from the collection's
 * `ruleData.materialNormalization`. Only pricing (D) still calls the helpers without a
 * profile, so it falls back to the legacy table; while that lasts the two must stay equal.
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

describe("material filter groups and vessel-compatible materials", () => {
  it("keep the legacy defaults equal to the USH profile", () => {
    expect(selectMaterialHierarchy(ushProfile)).toEqual(
      LEGACY_MATERIAL_HIERARCHY.map(({ value, label, childValues, aliases }) => ({ value, label, childValues, aliases })),
    );
    expect(ushProfile.ruleData.materialNormalization?.vesselCompatibleCountertopMaterialTokens).toEqual(
      LEGACY_VESSEL_COMPATIBLE_COUNTERTOP_MATERIAL_TOKENS,
    );
  });

  it("group material filters by the collection's hierarchy", () => {
    const flat = [
      { label: "Glass MT", value: "Glass MT" },
      { label: "Glass GL", value: "Glass GL" },
      { label: "HPL", value: "HPL" },
    ];

    expect(groupMaterialsHierarchically(flat, selectMaterialHierarchy(ushProfile)).map(({ label }) => label)).toEqual(
      groupMaterialsHierarchically(flat).map(({ label }) => label),
    );
    // A collection with its own grouping gets it; the legacy one is only the default.
    const ownGroups = [{ value: "stone", label: "Stone", childValues: ["HPL"] }];
    expect(groupMaterialsHierarchically(flat, ownGroups).map(({ label }) => label)).toContain("Stone");
  });

  it("decide which countertop colours take a vessel by the collection's materials", () => {
    expect(isVesselCompatibleCountertopMaterial(["SSTKR"], ushProfile)).toBe(true);
    expect(isVesselCompatibleCountertopMaterial(["Glass MT"], ushProfile)).toBe(false);
    // Without the section the legacy USH list applies, as before.
    expect(isVesselCompatibleCountertopMaterial(["HPL"], profileWithoutAliases)).toBe(true);
  });
});
