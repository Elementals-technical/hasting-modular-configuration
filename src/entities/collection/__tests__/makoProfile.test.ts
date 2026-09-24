import { describe, expect, it } from "vitest";

import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import makoManifest from "../../../../public/collections/mako/manifest.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { isDrawerStyleMixingRestricted, selectOptionValues } from "../lib/productProfileSelectors";

/**
 * The Mako product profile carries only what the Mako documents confirm: the WebGL Logic, the Mako price
 * workbook, the GB rules and the Master File. Where the Master File conflicts with the product map, the map wins.
 *
 * Mako is neither Urban nor Class: G57/G50 handles with their own colour, legs with their own colour, no
 * inner-drawer style and thin countertops only. This test also guards against those values leaking in.
 */

const parsed = parseProductProfile(makoProfileDocument);

const profile = () => {
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

const attribute = (attributeId: string) =>
  profile().attributes.find((candidate) => candidate.attributeId === attributeId);

const categoryCounts = (attributeId: string) =>
  (attribute(attributeId)?.options ?? []).reduce<Record<string, number>>((counts, { category }) => {
    const key = category ?? "";
    return { ...counts, [key]: (counts[key] ?? 0) + 1 };
  }, {});

describe("mako product profile", () => {
  it("is valid without diagnostics", () => {
    // On failure the diagnostics are the message: the assertion shows what the profile got wrong.
    expect(parsed.ok ? [] : parsed.diagnostics).toEqual([]);
    expect(profile().collectionId).toBe("mako");
  });

  it("is loaded by the collection manifest", () => {
    expect(makoManifest.local.productProfile).toBe("product-profile.json");
  });

  it("declares Sink Base and Side Cabinet only (map section 1)", () => {
    expect(selectOptionValues(profile(), "CabinetType")).toEqual(["Sink-Base", "Sink-Cabinet"]);
  });

  it("has one- and two-drawer styles with their heights, and no inner drawer (section 2)", () => {
    expect(selectOptionValues(profile(), "Drawers")).toEqual(["1", "2"]);
    expect(JSON.stringify(attribute("Drawers"))).not.toContain("1DWID");
    expect(selectOptionValues(profile(), "Height")).toEqual(["26", "52"]);
  });

  it("offers the G57 and G50 handles without a groove colour (section 4)", () => {
    expect(selectOptionValues(profile(), "Handle")).toEqual(["G57", "G50"]);
    expect(attribute("Handle")?.options?.map(({ capabilities }) => capabilities?.supportsGrooveColor)).toEqual([
      false,
      false,
    ]);
  });

  // Mako has its own configurator (9); its colours, their material and their SKU come from there
  // rather than being copied into this profile. The catalogs it still lists are shapes, not colours.
  it("takes the colour catalogs from its own configurator instead of listing them", () => {
    const colours = ["CabinetColor", "HandleColor", "LegColor", "CountertopColor"].map((attributeId) => [
      attributeId,
      attribute(attributeId)?.optionsSource,
      attribute(attributeId)?.options,
    ]);

    expect(colours).toEqual([
      ["CabinetColor", "configurator:Select Cabinet Color", undefined],
      ["HandleColor", "configurator:Select Handle Color", undefined],
      ["LegColor", "configurator:Select Leg Color", undefined],
      ["CountertopColor", "configurator:Select Countertop Color", undefined],
    ]);
  });

  it("still lists the catalogs that are shapes rather than colours", () => {
    expect(categoryCounts("sinkType")).toEqual({ integrated: 9, vessel: 3 });
    expect(selectOptionValues(profile(), "DividersStyle")).toEqual(["Metal", "Oak"]);
    expect(selectOptionValues(profile(), "Handle")).toEqual(["G57", "G50"]);
  });

  it("leaves out what the thin-only rule excludes and what the Master File lacks (sections 7, 9)", () => {
    expect(selectOptionValues(profile(), "CountertopColor")).not.toContain("Matte White 8cm");
    expect(selectOptionValues(profile(), "sinkType")).not.toContain("VA023");
    expect(selectOptionValues(profile(), "sinkType")).not.toContain("VA030");
  });

  it("has nine integrated basins and the three vessel styles", () => {
    const basins = attribute("sinkType")?.options ?? [];

    expect(basins.filter(({ category }) => category === "integrated").map(({ value }) => value)).toEqual([
      "LB440",
      "LB175",
      "LB575",
      "LB856",
      "VA024",
      "LV890",
      "LV892",
      "VA002",
      "VA005",
    ]);
    expect(basins.filter(({ category }) => category === "vessel").map(({ value }) => value)).toEqual([
      "Iris",
      "Frame",
      "Plaza",
    ]);
  });

  it("has the confirmed countertop, faucet and divider options", () => {
    expect(selectOptionValues(profile(), "CountertopStyle")).toEqual(["integrated", "vessel"]);
    expect(selectOptionValues(profile(), "FaucetHolesAmount")).toEqual(["0", "1", "2", "3"]);
    expect(selectOptionValues(profile(), "DividersStyle")).toEqual(["Metal", "Oak"]);
  });

  it("inherits no Urban or Class value", () => {
    const document = JSON.stringify(makoProfileDocument);

    expect(document).not.toContain("handle_urban");
    expect(document).not.toContain("Open-Shelf");
    expect(attribute("CabinetSideColor")).toBeUndefined();
    expect(attribute("FrameColor")).toBeUndefined();
    expect(selectOptionValues(profile(), "Height")).not.toContain("40");
  });

  it("declares the drawer style groups and the changes the product has not decided yet", () => {
    expect(Object.keys(profile().ruleData).sort()).toEqual([
      "cabinetMatrixLegacyAdapter",
      "drawerStyleGroups",
      "undeterminedRules",
    ]);
    expect(profile().ruleData.undeterminedRules).toEqual([
      expect.objectContaining({ ruleId: "MAKO-LEG-002", attributeId: "LegColor", whenCabinet: { Drawers: ["1"] } }),
    ]);
  });

  it("records the confirmed rules it cannot express yet", () => {
    expect(Object.keys(makoProfileDocument.excludedFromThisProfile)).toEqual(
      expect.arrayContaining([
        "sourceRefs",
        "matteWhite8cm",
        "va023",
        "va030",
        "legsOnlyForTwoDrawers",
        "compositionLimits",
        "floating",
      ]),
    );
  });
});

describe("mako drawer style mixing (section 2)", () => {
  it("keeps one-drawer and two-drawer cabinets apart", () => {
    expect(isDrawerStyleMixingRestricted(profile(), ["1DW"], "2DW")).toBe(true);
    expect(isDrawerStyleMixingRestricted(profile(), ["2DW"], "1DW")).toBe(true);
  });

  it("lets cabinets of the same style be combined", () => {
    expect(isDrawerStyleMixingRestricted(profile(), ["1DW"], "1DW")).toBe(false);
    expect(isDrawerStyleMixingRestricted(profile(), ["2DW"], "2DW")).toBe(false);
  });
});
