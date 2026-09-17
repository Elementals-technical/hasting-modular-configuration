import { describe, expect, it } from "vitest";

import configurator4 from "./fixtures/remote/configurator-4.json";
import urbanLowHeightProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";

import type { ConfiguratorGroupCatalog } from "../model/types";
import { parseProductProfile } from "../lib/parseProductProfile";
import { selectOptionValues } from "../lib/productProfileSelectors";
import { flutingRule } from "@/features/configurator-rule-core/options/rules/flutingRule";
import { resolveColorTraits } from "@/features/configurationCommands/lib/resolveColorTraits";

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

  it("has the two handles, and neither offers a groove colour until its SKU structure is confirmed", () => {
    const handle = profile().attributes.find(({ attributeId }) => attributeId === "Handle");

    expect(selectOptionValues(profile(), "Handle")).toEqual(["handle_urban_topcut", "handle_pto"]);
    expect(handle?.options?.map(({ value, capabilities }) => [value, capabilities?.supportsGrooveColor])).toEqual([
      ["handle_urban_topcut", false],
      ["handle_pto", false],
    ]);
  });

  it("has the four heights of this collection", () => {
    expect(selectOptionValues(profile(), "Height")).toEqual(["38", "35", "28", "25"]);
  });

  it("names every fluting by the product map's type A or B and maps it to its SKU code", () => {
    const fluting = profile().attributes.find(({ attributeId }) => attributeId === "DrawerPanelFluting");

    expect(fluting?.options?.map(({ value, label, aliases }) => [value, label, aliases?.[0]])).toEqual([
      ["None", "None", "X"],
      ["FlutingVerticalA", "Vertical A", "CVA"],
      ["FlutingVerticalB", "Vertical B", "CVB"],
      ["FlutingHorizontalA", "Horizontal A", "CHA"],
      ["FlutingHorizontalB", "Horizontal B", "CHB"],
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
    expect(document).not.toContain("SIDE_PANEL");
    expect(selectOptionValues(profile(), "Height")).not.toContain("53");
    expect(selectOptionValues(profile(), "Drawers")).not.toContain("2");
    expect(selectOptionValues(profile(), "CabinetType")).not.toContain("Side-Shelf");
  });

  it("declares only the rule sections the product map confirms", () => {
    expect(Object.keys(profile().ruleData).sort()).toEqual(
      ["cabinetColorTraits", "cabinetMatrixLegacyAdapter", "fluting"].sort(),
    );
  });

  it("records the confirmed limits it cannot express yet", () => {
    expect(Object.keys(urbanLowHeightProfileDocument.excludedFromThisProfile)).toEqual(
      expect.arrayContaining(["handleHeightCoupling", "openShelfWidthByHeight", "openSideShelfSizes"]),
    );
  });
});

describe("urban-low-height fluting (product map §4)", () => {
  it("is offered for a Lacquer Matte cabinet, with the five facade variants", () => {
    const result = flutingRule({ material: "LACM" }, profile());

    expect(result.available).toBe(true);
    expect(result.options.map(({ value }) => value)).toEqual([
      "None",
      "FlutingVerticalA",
      "FlutingVerticalB",
      "FlutingHorizontalA",
      "FlutingHorizontalB",
    ]);
  });

  it.each(["3D", "LACG", "ST", "BM", "HPL", "Essenze"])("is refused for %s, with the reason", (material) => {
    const result = flutingRule({ material }, profile());

    expect(result.available).toBe(false);
    expect(result.reasonCode).toBe("fluting.requiresLacquerMatte");
    expect(result.reason).toBe("Fluting is available only for Lacquer Matte (LACM).");
  });

  it("reads the material of a real configurator colour and refuses fluting for it", () => {
    const configurator = { groups: configurator4.availableOptions } as unknown as ConfiguratorGroupCatalog;
    const traits = resolveColorTraits("Castagno chiaro 1C1", configurator, profile());

    expect(traits?.material).toBe("3D");
    expect(flutingRule({ material: traits?.material }, profile()).available).toBe(false);
  });
});
