import { describe, expect, it } from "vitest";

import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";
import lameManifest from "../../../../public/collections/lame/manifest.json";
import { isVisibleConfiguratorVariant } from "@/entities/configurator/lib/isVisibleConfiguratorVariant";

import configurator9Document from "./fixtures/remote/configurator-9.json";
import { parseProductProfile } from "../lib/parseProductProfile";
import {
  isDrawerStyleMixingRestricted,
  selectConfiguratorSection,
  selectDefaultValue,
  selectOptionValues,
} from "../lib/productProfileSelectors";
import { configuratorSchema } from "../model/schemas";

/**
 * The Lame product profile carries only what the Lame documents confirm: the WebGL Logic, the Lame price
 * workbook (countertops, basins and accessories through the Class workbook), the GB rules and the Master
 * File. Where the Master File conflicts with the price workbook, the workbook wins.
 *
 * Lame is built like Mako but is not Mako: one G58 handle, five cabinet patterns, VA030 instead of the
 * VA023 of the Master File. Legs, side panels and the undertop come later (excludedFromThisProfile).
 */

const parsed = parseProductProfile(lameProfileDocument);

const profile = () => {
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

const attribute = (attributeId: string) =>
  profile().attributes.find((candidate) => candidate.attributeId === attributeId);

const configurator9 = configuratorSchema.parse(configurator9Document);

/** The colours a configurator section offers: a variant without a SKU is not offered. */
const offeredColours = (attributeId: string) => {
  const section = selectConfiguratorSection(profile(), attributeId);
  const group = configurator9.availableOptions.find(({ proxyName }) => proxyName === section);

  return (group?.options ?? []).flatMap(({ variants }) =>
    variants.filter(isVisibleConfiguratorVariant).map(({ name }) => name),
  );
};

describe("lame product profile", () => {
  it("is valid without diagnostics", () => {
    // On failure the diagnostics are the message: the assertion shows what the profile got wrong.
    expect(parsed.ok ? [] : parsed.diagnostics).toEqual([]);
    expect(profile().collectionId).toBe("lame");
  });

  it("is loaded by the collection manifest", () => {
    expect(lameManifest.local.productProfile).toBe("product-profile.json");
  });

  it("declares Sink Base and Side Cabinet only (map section 2)", () => {
    expect(selectOptionValues(profile(), "CabinetType")).toEqual(["Sink-Base", "Sink-Cabinet"]);
  });

  it("has one- and two-drawer styles that are not mixed, with their heights", () => {
    expect(selectOptionValues(profile(), "Drawers")).toEqual(["1", "2"]);
    expect(JSON.stringify(attribute("Drawers"))).not.toContain("1DWID");
    expect(selectOptionValues(profile(), "Height")).toEqual(["26", "52"]);
    expect(isDrawerStyleMixingRestricted(profile(), ["1DW"], "2DW")).toBe(true);
    expect(isDrawerStyleMixingRestricted(profile(), ["2DW"], "1DW")).toBe(true);
    expect(isDrawerStyleMixingRestricted(profile(), ["2DW"], "2DW")).toBe(false);
  });

  it("has the one G58 handle, which nobody chooses, without a groove colour (map section 3)", () => {
    expect(selectOptionValues(profile(), "Handle")).toEqual(["G58"]);
    expect(attribute("Handle")).toMatchObject({ initialValue: "G58", defaultValue: "G58" });
    expect(attribute("Handle")?.confirmation).toBeUndefined();
    expect(attribute("Handle")?.options?.[0]?.capabilities?.supportsGrooveColor).toBe(false);
  });

  it("offers five cabinet patterns for the whole composition, without None, starting from Oxford", () => {
    expect(selectOptionValues(profile(), "CabinetPattern")).toEqual([
      "Galles",
      "Gessato",
      "Oxford",
      "Piquet",
      "Plisse",
    ]);
    expect(attribute("CabinetPattern")?.scope).toBe("global");
    expect(selectDefaultValue(profile(), "CabinetPattern")).toBe("Oxford");
  });

  it("takes the colour catalogs from configurator 9 instead of listing them", () => {
    const colours = ["CabinetColor", "HandleColor", "CountertopColor", "VesselColor"].map((attributeId) => [
      attributeId,
      attribute(attributeId)?.optionsSource,
      attribute(attributeId)?.options,
    ]);

    expect(colours).toEqual([
      ["CabinetColor", "configurator:Select Cabinet Color", undefined],
      ["HandleColor", "configurator:Select Handle Color", undefined],
      ["CountertopColor", "configurator:Select Countertop Color", undefined],
      ["VesselColor", "configurator:Select Cabinet Color", undefined],
    ]);
    expect(lameManifest.remote.configurator.id).toBe(9);
  });

  it("names the configurator and the tables its manifest loads", () => {
    expect(profile().sourceRefs).toEqual({
      configuratorId: lameManifest.remote.configurator.id,
      countertopMatrixTableId: lameManifest.remote.countertopTable.id,
      cabinetMatrixTableId: lameManifest.remote.cabinetTable.id,
    });
    expect(profile().ruleData.cabinetMatrixLegacyAdapter.tableId).toBe(lameManifest.remote.cabinetTable.id);
  });

  // Master File: 40 cabinet colours, 22 handle colours, 71 countertop colours of which Matte White 8cm
  // has no thin top (map section 4).
  it("gets the Master File palettes from configurator 9, without the 8 cm top", () => {
    expect(offeredColours("CabinetColor")).toHaveLength(40);
    expect(offeredColours("HandleColor")).toHaveLength(22);
    expect(offeredColours("HandleColor")).toEqual(expect.arrayContaining(["Gold", "Silver"]));
    expect(offeredColours("CountertopColor")).toHaveLength(70);
    expect(offeredColours("CountertopColor")).toContain("Matte White");
    expect(offeredColours("CountertopColor")).not.toContain("Matte White 8cm");
  });

  it("starts from colours the collection offers", () => {
    expect(offeredColours("CabinetColor")).toContain(selectDefaultValue(profile(), "CabinetColor"));
    expect(offeredColours("CountertopColor")).toContain(selectDefaultValue(profile(), "CountertopColor"));
    expect(selectOptionValues(profile(), "sinkType")).toContain(selectDefaultValue(profile(), "sinkType"));
  });

  it("has the ten integrated basins of the price workbook, with VA030 rather than VA023", () => {
    const basins = attribute("sinkType")?.options ?? [];

    expect(basins.filter(({ category }) => category === "integrated").map(({ value }) => value)).toEqual([
      "LB440",
      "LB175",
      "LB575",
      "LB856",
      "VA030",
      "VA024",
      "LV890",
      "LV892",
      "VA002",
      "VA005",
    ]);
    expect(selectOptionValues(profile(), "sinkType")).not.toContain("VA023");
  });

  it("has the three described vessels and the cutout without one, but not Art or Diamond yet", () => {
    const basins = attribute("sinkType")?.options ?? [];

    expect(basins.filter(({ category }) => category === "vessel").map(({ value }) => value)).toEqual([
      "None",
      "Iris",
      "Frame",
      "Plaza",
    ]);
    expect(attribute("sinkType")?.noneValue).toBe("None");
    expect(Object.keys(profile().ruleData.vesselCompatibility?.allowedMaterialsByStyle ?? {})).toEqual([
      "Iris",
      "Frame",
      "Plaza",
    ]);
  });

  it("has the thin countertops, the faucet holes and the Class organizers", () => {
    expect(selectOptionValues(profile(), "CountertopStyle")).toEqual(["integrated", "vessel"]);
    expect(selectOptionValues(profile(), "Thickness")).toEqual(["0.5", "0.75"]);
    expect(selectOptionValues(profile(), "FaucetHolesAmount")).toEqual(["0", "1", "2", "3"]);
    expect(selectOptionValues(profile(), "DividersStyle")).toEqual(["Metal", "Oak"]);
  });

  it("inherits no Mako or Urban value", () => {
    const document = JSON.stringify(lameProfileDocument);

    expect(document).not.toContain("G57");
    expect(document).not.toContain("G50");
    expect(document).not.toContain("handle_urban");
    expect(document).not.toContain("Open-Shelf");
    expect(attribute("LegColor")).toBeUndefined();
    expect(profile().ruleData.undeterminedRules).toBeUndefined();
  });

  it("records what it does not offer yet and why", () => {
    expect(Object.keys(lameProfileDocument.excludedFromThisProfile)).toEqual(
      expect.arrayContaining(["scene", "legs", "sidePanels", "undertop", "vesselArtDiamond", "matteWhite8cm", "va023"]),
    );
    expect(attribute("Legs")).toBeUndefined();
    expect(attribute("SidePanels")).toBeUndefined();
    expect(attribute("Undertop")).toBeUndefined();
  });
});
