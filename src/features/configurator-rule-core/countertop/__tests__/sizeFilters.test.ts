import { describe, expect, it } from "vitest";

import udProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import datatable594 from "@/entities/collection/__tests__/fixtures/remote/datatable-594.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { countertopDatatableSchema } from "@/entities/collection/model/schemas";

import { parseCountertopMatrix } from "../parse";
import { filterWidthValuesByCountertopRules, isCountertopRuleWidthAllowed } from "../sizeFilters";

/**
 * A Sink Base is offered at every width of the cabinet table: an integrated basin that needs a wider
 * Sink Base (`min_sb_cm`) follows the cabinet, it does not narrow the width list. The countertop's own
 * limits still do.
 */

const udProfile = (() => {
  const result = parseProductProfile(udProfileDocument);
  if (!result.ok) throw new Error("Urban Duplex profile must parse");
  return result.profile;
})();

const udCountertopRules = parseCountertopMatrix(countertopDatatableSchema.parse(datatable595));

const udSinkBaseWidths = (() => {
  const row = datatable594.rows.find((candidate) => candidate.cabinet_type === "Sink-Base");
  if (!row) throw new Error("Urban Duplex cabinet table must list the Sink Base");
  return row.widths_cm.split("|").map(Number);
})();

const sinkBaseWidthsWithStrip = (values: Array<string | number>, rules = udCountertopRules) =>
  filterWidthValuesByCountertopRules({
    profile: udProfile,
    values,
    isSinkBaseCabinet: true,
    activeMaterialTokens: ["hpl"],
    rules,
    selectedDepth: 50,
    activeCountertopStyle: "integrated",
    activeBasinStyle: "Top_HPLStrip",
  });

describe("the Sink Base width list under an integrated basin", () => {
  it("offers every Sink Base width of the table though the HPL Strip basin needs 70 cm", () => {
    expect(sinkBaseWidthsWithStrip(udSinkBaseWidths)).toEqual(udSinkBaseWidths);
  });

  it("still refuses a width beyond the countertop's integrated maximum", () => {
    expect(sinkBaseWidthsWithStrip([60, 270, 280])).toEqual([60, 270]);
  });

  it("still keeps to the sizes a row allows an integrated basin only at", () => {
    const rules = udCountertopRules.map((rule) => ({ ...rule, integratedAllowedSizesOnly: [70, 90] }));

    expect(sinkBaseWidthsWithStrip(udSinkBaseWidths, rules)).toEqual([70, 90]);
  });
});

describe("the Sink Base minimum of a countertop row", () => {
  const stripRule = udCountertopRules.find((rule) => rule.material === "HPL" && rule.basinStyle === "Strip 48");

  it("refuses a narrower Sink Base where the width list does not ask to leave it out", () => {
    if (!stripRule) throw new Error("Urban Duplex countertop table must have the HPL Strip row");
    const verdict = (shouldApplyBasinMinimum?: boolean) =>
      isCountertopRuleWidthAllowed({
        rule: stripRule,
        width: 60,
        style: "integrated",
        context: "sink-base",
        activeBasinStyle: "Top_HPLStrip",
        profile: udProfile,
        shouldApplyBasinMinimum,
      });

    expect(verdict()).toBe(false);
    expect(verdict(false)).toBe(true);
  });
});
