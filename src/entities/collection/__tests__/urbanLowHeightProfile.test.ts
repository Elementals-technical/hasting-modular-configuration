import { describe, expect, it } from "vitest";

import configurator4 from "./fixtures/remote/configurator-4.json";
import urbanLowHeightProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightManifest from "../../../../public/collections/urban-low-height/manifest.json";

import type { ConfiguratorGroupCatalog } from "../model/types";
import { parseProductProfile } from "../lib/parseProductProfile";
import { selectOptions, selectOptionValues } from "../lib/productProfileSelectors";
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

  it("names the sources its manifest loads, and the manifest holds it to them", () => {
    expect(urbanLowHeightManifest.requireSourceAgreement).toBe(true);
    expect(profile().sourceRefs).toEqual({
      configuratorId: urbanLowHeightManifest.remote.configurator.id,
      countertopMatrixTableId: urbanLowHeightManifest.remote.countertopTable.id,
      cabinetMatrixTableId: urbanLowHeightManifest.remote.cabinetTable.id,
    });
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

  it("has the two handles, and the upper groove offers a groove colour, which push-to-open has none of", () => {
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

  it("starts a cabinet at 38 cm, the height the models stand at", () => {
    expect(profile().attributes.find(({ attributeId }) => attributeId === "Height")?.defaultValue).toBe("38");
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
      ["CabinetColor", "HandleGrooveColor", "CountertopColor"].includes(attributeId),
    );

    expect(colours.map(({ attributeId, optionsSource, options }) => [attributeId, optionsSource, options])).toEqual([
      ["CabinetColor", "configurator:Cabinet Color", undefined],
      ["HandleGrooveColor", "configurator:Handle Groove Color", undefined],
      ["CountertopColor", "configurator:Countertop Color", undefined],
    ]);
  });

  it("offers the Urban Standard Height countertop styles, which the product map does not describe (§11)", () => {
    const style = profile().attributes.find(({ attributeId }) => attributeId === "CountertopStyle");

    expect(style?.scope).toBe("countertop");
    expect(style?.options?.map(({ value, label }) => [value, label])).toEqual([
      ["integrated", "Integrated"],
      ["vessel", "Vessel"],
    ]);
  });

  it("offers the basins and vessel colours Urban Standard Height shows, without its hidden legacy vessels", () => {
    const basins = selectOptions(profile(), "sinkType");
    const basin = profile().attributes.find(({ attributeId }) => attributeId === "sinkType");
    const vesselColor = profile().attributes.find(({ attributeId }) => attributeId === "VesselColor");

    expect(basin?.noneValue).toBe("Vessel");
    expect(basins.filter(({ category }) => category === "integrated")).toHaveLength(28);
    // None (the scene's "Vessel" cutout) comes first, as the Urban Standard Height countertop step shows it.
    expect(basins.filter(({ category }) => category === "vessel").map(({ value, label }) => [value, label])).toEqual([
      ["Vessel", "None"],
      ["Vessel_Blade11", "Vessel Blade 11"],
      ["Vessel_Blade18", "Vessel Blade 18"],
      ["Vessel_UrbanModo", "Vessel Urban Modo"],
      ["Vessel_UrbanMorris", "Vessel Urban Morris"],
      ["Vessel_Aquarius", "Vessel Acquarius"],
    ]);
    expect(vesselColor?.optionsSource).toBe("configurator:Vessels");
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

  it("declares the rule sections the product map confirms, and the side panels, vessel compatibility and Drag & Drop added on request", () => {
    expect(Object.keys(profile().ruleData).sort()).toEqual(
      [
        "cabinetColorTraits",
        "cabinetMatrixLegacyAdapter",
        "countertopFallbacks",
        "dragDrop",
        "fluting",
        "sidePanels",
        "vesselCompatibility",
      ].sort(),
    );
  });

  it("says what each countertop thickness can do: thin tops stay, 2.4″ and 4″ slide, 4″ carries a vessel, 5⅛″ and 5½″ lift", () => {
    const capabilitiesOf = (value: string) =>
      selectOptions(profile(), "Thickness").find((option) => option.value === value)?.capabilities;

    for (const thin of ["0.375", "0.4", "0.5"]) expect(capabilitiesOf(thin)).toBeUndefined();
    expect(capabilitiesOf("2.4")).toMatchObject({ countertopSlides: true });
    expect(capabilitiesOf("2.4")?.countertopLifts).toBeUndefined();
    expect(capabilitiesOf("4")).toMatchObject({
      countertopSlides: true,
      countertopCarriesVessel: true,
      countertopLengthResize: true,
    });
    expect(capabilitiesOf("4")?.countertopLifts).toBeUndefined();
    for (const floating of ["5.125", "5.5"])
      expect(capabilitiesOf(floating)).toMatchObject({
        countertopSlides: true,
        countertopLifts: true,
        countertopLengthResize: true,
      });
  });

  it("hides the countertop materials of configurator 4 that Urban Low Height does not offer (§11)", () => {
    const countertop = profile().ruleData.countertopFallbacks;

    // Tekorlux and Glass colours carry "Lacquered MT/GL" as their material, so both names are excluded.
    expect(countertop?.excludedMaterialFilterTokens).toEqual([
      "tekorlux",
      "tekormud",
      "glassmt",
      "glassgl",
      "lacqueredmt",
      "lacqueredgl",
    ]);
    // Solid-Surface is kept under both configurator names until the product side names one.
    expect(countertop?.excludedMaterialFilterTokens).not.toContain("mineralmarmo");
    expect(countertop?.excludedMaterialFilterTokens).not.toContain("ocritech");
    // No integrated-basin restriction is confirmed for this collection.
    expect(countertop).toMatchObject({
      needsConfirmation: true,
      restrictedIntegratedDepthsCm: [],
      restrictedIntegratedMaterialTokens: [],
      restrictedIntegratedBasinKeys: [],
    });
  });

  it("records the confirmed limits it cannot express yet", () => {
    expect(Object.keys(urbanLowHeightProfileDocument.excludedFromThisProfile)).toEqual(
      expect.arrayContaining(["openShelfWidthByHeight", "openSideShelfSizes"]),
    );
  });

  it("gives each handle its heights from the cabinet table: upper groove 38/28 cm, push-to-open 35/25 cm (§2)", () => {
    expect(profile().ruleData.cabinetMatrixLegacyAdapter.columns.heightsByHandle).toEqual({
      handle_urban_topcut: "handle_urban_topcut_heights_cm",
      handle_pto: "handle_pto_heights_cm",
    });
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
