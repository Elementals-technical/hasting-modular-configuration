import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classManifest from "../../../../public/collections/class/manifest.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { isDrawerStyleMixingRestricted, selectOptionValues } from "../lib/productProfileSelectors";

/**
 * The Class product profile carries only what the Class documents confirm: the WebGL Scoping rules,
 * the Class price workbook and the Master File register.
 *
 * Class is not a variant of Urban: no handle choice, a frame and side colour of its own, and colour
 * catalogs that configurator 4 does not hold. This test also guards against Urban values leaking in.
 */

const parsed = parseProductProfile(classProfileDocument);

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

describe("class product profile", () => {
  it("is valid without diagnostics", () => {
    // On failure the diagnostics are the message: the assertion shows what the profile got wrong.
    expect(parsed.ok ? [] : parsed.diagnostics).toEqual([]);
    expect(profile().collectionId).toBe("class");
  });

  it("is loaded by the collection manifest", () => {
    expect(classManifest.local.productProfile).toBe("product-profile.json");
  });

  it("declares Sink Base and Side Cabinet only (CLS-WGL-001)", () => {
    expect(selectOptionValues(profile(), "CabinetType")).toEqual(["Sink-Base", "Sink-Cabinet"]);
  });

  it("has the three drawer styles and the two heights of the price workbook", () => {
    expect(selectOptionValues(profile(), "Drawers")).toEqual(["1", "2", "1+inner"]);
    expect(
      attribute("Drawers")?.options?.map(({ aliases }) =>
        aliases?.find((alias) => alias.endsWith("DW") || alias.endsWith("DWID")),
      ),
    ).toEqual(["1DW", "2DW", "1DWID"]);
    expect(selectOptionValues(profile(), "Height")).toEqual(["40", "52"]);
  });

  it("offers no handle: the grip is part of the frame (CLS-WGL-003)", () => {
    expect(attribute("Handle")).toBeUndefined();
    expect(profile().ruleData.cabinetMatrixLegacyAdapter.columns.forcedHeightByHandle).toEqual({});
  });

  // The colour catalogs come from the configurator the manifest names. Class has no configurator
  // of its own yet, so it reads Mako's 9 and only the shared lacquers reach it; the five other
  // front materials its SKU profile names return once configurator 8 carries Class data.
  it("takes the colour catalogs from the configurator instead of listing them", () => {
    const colours = ["CabinetColor", "CabinetSideColor", "FrameColor", "CountertopColor"].map((attributeId) => [
      attributeId,
      attribute(attributeId)?.optionsSource,
      attribute(attributeId)?.options,
    ]);

    expect(colours).toEqual([
      ["CabinetColor", "configurator:Select Cabinet Color", undefined],
      ["CabinetSideColor", "configurator:Select Cabinet Color", undefined],
      ["FrameColor", "configurator:Select Cabinet Color", undefined],
      ["CountertopColor", "configurator:Select Countertop Color", undefined],
    ]);
  });

  it("still lists the catalogs that are shapes rather than colours", () => {
    expect(categoryCounts("sinkType")).toEqual({ integrated: 10, vessel: 3 });
    expect(selectOptionValues(profile(), "DividersStyle")).toEqual(["Metal", "Oak"]);
  });

  it("has the ten integrated basin codes and the three vessel styles", () => {
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
      "VA023",
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

  it("inherits no Urban Standard Height value", () => {
    const document = JSON.stringify(classProfileDocument);

    expect(document).not.toContain("handle_urban");
    expect(document).not.toContain("handle_pto");
    expect(document).not.toContain("Open-Shelf");
    expect(document).not.toContain("urban-standard-height");
    expect(selectOptionValues(profile(), "Height")).not.toContain("53");
  });

  it("declares only the drawer style groups as a rule section", () => {
    expect(Object.keys(profile().ruleData).sort()).toEqual(["cabinetMatrixLegacyAdapter", "drawerStyleGroups"]);
  });

  it("records the confirmed rules it cannot express yet", () => {
    expect(Object.keys(classProfileDocument.excludedFromThisProfile)).toEqual(
      expect.arrayContaining([
        "handle",
        "sourceRefs",
        "heightByStyle",
        "integratedSb60WithInnerDrawer",
        "compositionLimits",
        "thickness",
      ]),
    );
  });
});

describe("class drawer style mixing (CLS-WGL-004/005)", () => {
  it("keeps 2DW with 2DW only", () => {
    expect(isDrawerStyleMixingRestricted(profile(), ["2DW"], "1DW")).toBe(true);
    expect(isDrawerStyleMixingRestricted(profile(), ["1DW"], "2DW")).toBe(true);
    expect(isDrawerStyleMixingRestricted(profile(), ["2DW"], "2DW")).toBe(false);
  });

  it("lets 1DW and 1DWID be mixed", () => {
    expect(isDrawerStyleMixingRestricted(profile(), ["1DW"], "1DWID")).toBe(false);
    expect(isDrawerStyleMixingRestricted(profile(), ["1DWID"], "1DW")).toBe(false);
  });
});
