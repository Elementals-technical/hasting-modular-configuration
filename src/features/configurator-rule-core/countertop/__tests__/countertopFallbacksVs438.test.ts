import { describe, expect, it } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import type { ProductProfile } from "@/entities/collection";

import { materialMatchesRule, normalizeBasinKey, parseCountertopMatrix, selectMaterialAliasTable } from "../parse";
import { filterDepthValuesByCountertopRules, isIntegratedCountertopDepthRestrictedByMaterial } from "../sizeFilters";
import type { CountertopDatatable } from "@/entities/countertop/api/types";

/**
 * DEV-06: `ruleData.countertopFallbacks` of USH is marked `needsConfirmation`: nobody has said
 * whether it repeats table 438 or adds to it. This pins what the code does today against the
 * frozen table, so the product decision has the facts and any change shows up here.
 *
 * Found on the frozen 438:
 * - every restricted material token matches a 438 row through the alias table, so the depth
 *   filter always reads the table and never the fallback: there it is a duplicate;
 * - the restricted basins (Oly 55, Oly 56, Orion) are 50.5 cm only in 438: a duplicate too;
 * - but the countertop pages also ask the fallback directly ("depth 46 → vessel only") without
 *   looking at the table, and 438 allows Ocritech Rayo, Roll and Quadra integrated at 46 cm.
 *   That is the one place where the fallback changes the outcome, and it contradicts the table.
 * - that direct check compares tokens without the alias table: an Ocritech colour is restricted
 *   when named by its SKU family (SSOCR) and not when named "Ocritech".
 */

const rules = parseCountertopMatrix(datatable438 as unknown as CountertopDatatable);
const fallbacks = ushProfile.ruleData.countertopFallbacks;
const aliasTable = selectMaterialAliasTable(ushProfile);

const withoutFallbacks: ProductProfile = {
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, countertopFallbacks: undefined },
};

const integratedDepths = (material: string, basin: string, profile: ProductProfile) =>
  filterDepthValuesByCountertopRules({
    values: [46, 50.5],
    activeMaterialTokens: [material],
    rules,
    activeCountertopStyle: "integrated",
    activeBasinStyle: basin,
    profile,
  });

describe("USH countertop fallbacks against table 438", () => {
  it("is still waiting for a product decision", () => {
    expect(fallbacks?.needsConfirmation).toBe(true);
  });

  it("restricts only materials the table already lists", () => {
    for (const token of fallbacks?.restrictedIntegratedMaterialTokens ?? []) {
      expect(rules.some((rule) => materialMatchesRule(token, rule.material, aliasTable))).toBe(true);
    }
  });

  it("does not change the depths the table gives: the depth filter reads 438 for these materials", () => {
    for (const [material, basin] of [
      ["Tekorund", "Top_Tekormud_Tivi"],
      ["Ocritech", "Top_Ocritech_Rayo"],
      ["Ocritech", "Top_Ocritech_Oly55"],
      ["Mineralmarmo", "Top_Mineralmarmo_Diamond"],
    ] as const) {
      expect(integratedDepths(material, basin, ushProfile)).toEqual(integratedDepths(material, basin, withoutFallbacks));
    }
  });

  it("repeats the table for the restricted basins: 438 lists them at 50.5 cm only", () => {
    const restricted = new Set(fallbacks?.restrictedIntegratedBasinKeys ?? []);
    const rows = rules.filter((rule) => restricted.has(normalizeBasinKey(rule.basinStyle)));

    expect(rows.map((rule) => normalizeBasinKey(rule.basinStyle)).sort()).toEqual(["oly55", "oly56", "orion"]);
    for (const rule of rows) expect(rule.depths).toEqual([50.5]);
  });

  it("contradicts the table on one case: Ocritech integrated at 46 cm", () => {
    // The pages pass the colour's SKU material family: SSOCR for an Ocritech colour.
    const ocritechColor = ["SSOCR"];

    // 438 allows it for Rayo, Roll and Quadra…
    expect(integratedDepths(ocritechColor[0], "Top_Ocritech_Rayo", ushProfile)).toContain(46);
    expect(integratedDepths(ocritechColor[0], "Top_Ocritech_Roll", ushProfile)).toContain(46);
    expect(integratedDepths(ocritechColor[0], "Top_Ocritech_Quadra", ushProfile)).toContain(46);
    // …while the check the countertop pages use offers only a vessel at that depth.
    expect(
      isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens: ocritechColor, depth: 46, profile: ushProfile }),
    ).toBe(true);
    // Named by its material instead of its SKU family, the same colour is not restricted.
    expect(
      isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens: ["Ocritech"], depth: 46, profile: ushProfile }),
    ).toBe(false);
  });
});
