import { describe, expect, it } from "vitest";

import urbanLowHeightProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { selectOptionValues } from "../lib/productProfileSelectors";

/**
 * The Urban Low Height product profile carries only what the product map confirms.
 *
 * Its facts differ from Urban Standard Height — one drawer style, two handles, four heights of
 * its own — so this test also guards against USH values being inherited by accident.
 */

const parsed = parseProductProfile(urbanLowHeightProfileDocument);

const profile = () => {
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

describe("urban-low-height product profile", () => {
  it("is valid without diagnostics", () => {
    // On failure the diagnostics are the message: the assertion shows what the profile got wrong.
    expect(parsed.ok ? [] : parsed.diagnostics).toEqual([]);
    expect(profile().collectionId).toBe("urban-low-height");
  });

  it("is loaded by the collection manifest", () => {
    expect(urbanLowHeightManifest.local.productProfile).toBe("product-profile.json");
    expect(urbanLowHeightManifest.id).toBe("urban-low-height");
  });

  it("declares the four confirmed module types", () => {
    expect(selectOptionValues(profile(), "CabinetType")).toEqual([
      "Sink-Base",
      "Side-Cabinet",
      "Open-Shelf",
      "Open-Side-Shelf",
    ]);
  });

  it("has one drawer style, spelled as the SKU matrix spells it", () => {
    const drawers = profile().attributes.find(({ attributeId }) => attributeId === "Drawers");

    expect(selectOptionValues(profile(), "Drawers")).toEqual(["1"]);
    expect(drawers?.options?.[0]?.aliases).toContain("1DW");
  });

  it("has the two handles and their groove capability", () => {
    const handle = profile().attributes.find(({ attributeId }) => attributeId === "Handle");

    expect(selectOptionValues(profile(), "Handle")).toEqual(["handle_urban_topcut", "handle_pto"]);
    expect(handle?.options?.map(({ value, capabilities }) => [value, capabilities?.supportsGrooveColor])).toEqual([
      ["handle_urban_topcut", true],
      ["handle_pto", false],
    ]);
  });

  it("has the four heights of this collection", () => {
    expect(selectOptionValues(profile(), "Height")).toEqual(["38", "35", "28", "25"]);
  });

  it("maps every fluting value to its SKU code", () => {
    const fluting = profile().attributes.find(({ attributeId }) => attributeId === "DrawerPanelFluting");

    expect(fluting?.options?.map(({ value, aliases }) => [value, aliases?.[0]])).toEqual([
      ["None", "X"],
      ["FlutingVerticalA", "CVA"],
      ["FlutingVerticalB", "CVB"],
      ["FlutingHorizontalA", "CHA"],
      ["FlutingHorizontalB", "CHB"],
    ]);
  });

  it("takes the colour catalogs from the configurator instead of listing them", () => {
    const colours = profile().attributes.filter(({ attributeId }) =>
      ["CabinetColor", "CountertopColor"].includes(attributeId),
    );

    expect(colours.map(({ attributeId, optionsSource, options }) => [attributeId, optionsSource, options])).toEqual([
      ["CabinetColor", "configurator:Cabinet Color", undefined],
      ["CountertopColor", "configurator:Countertop Color", undefined],
    ]);
  });

  it("inherits no Urban Standard Height value", () => {
    const document = JSON.stringify(urbanLowHeightProfileDocument);

    expect(document).not.toContain("handle_urban_botcut");
    expect(document).not.toContain("urban-standard-height");
    expect(selectOptionValues(profile(), "Height")).not.toContain("53");
    expect(selectOptionValues(profile(), "Drawers")).not.toContain("2");
    expect(selectOptionValues(profile(), "CabinetType")).not.toContain("Side-Shelf");
  });

  it("declares no rule section it cannot confirm", () => {
    expect(Object.keys(profile().ruleData)).toEqual(["cabinetMatrixLegacyAdapter"]);
  });
});
