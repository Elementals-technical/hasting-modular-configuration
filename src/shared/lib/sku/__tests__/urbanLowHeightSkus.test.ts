import { describe, expect, it } from "vitest";

import urbanLowHeightProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightSkuProfileDocument from "../../../../../public/collections/urban-low-height/sku-profile.json";

import configurator10 from "@/entities/collection/__tests__/fixtures/remote/configurator-10.json";
import { collectionSkuProfileSchema, parseProductProfile } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";

import { buildCollectionCabinetSku, resolveCollectionColorCode, type CollectionValueReader } from "../buildCollectionSkus";
import { createConfiguratorColorReader } from "../configuratorColors";
import { extractColorCode } from "../extractColorCode";

/**
 * Urban Low Height SKUs from its `sku-profile.json`. Each expected SKU is a form of the price
 * workbook (Pricing, in inches) that the price server resolved on 2026-09-25. The workbook writes
 * 38 and 28 cm as `15.0H` and `11.0H`; the SKU carries `15H` and `11H`, as the team spells them.
 * The HDL of an Upper Groove cabinet follows the price list's SKU formula (element #2); the server
 * has not been asked for these forms.
 */

const parsed = parseProductProfile(urbanLowHeightProfileDocument);
if (!parsed.ok) throw new Error("Urban Low Height profile failed validation");
const profile = parsed.profile;
const skuProfile = collectionSkuProfileSchema.parse(urbanLowHeightSkuProfileDocument);

const configuratorGroups = configurator10.availableOptions as unknown as ConfiguratorAvailableOption[];
const configurator: ConfiguratorGroupCatalog = {
  groups: configuratorGroups,
  groupsByName: Object.fromEntries(configuratorGroups.map((group) => [group.proxyName, group])),
};

const readConfiguratorColor = createConfiguratorColorReader(profile, configurator);

const reader =
  (values: Record<string, string>): CollectionValueReader =>
  (attributeId) =>
    values[attributeId] ?? null;

const cabinet = (values: Record<string, string>, widthCm: number, heightCm: number, depthCm = 50) =>
  buildCollectionCabinetSku(skuProfile, profile, {
    read: reader({ CabinetType: "Sink-Base", Drawers: "1", Handle: "handle_urban_topcut", ...values }),
    widthCm,
    heightCm,
    depthCm,
    readConfiguratorColor,
  });

describe("Urban Low Height cabinet SKU", () => {
  it("spells a sink base with the upper groove and no fluting, its groove in the cabinet colour", () => {
    expect(cabinet({ CabinetColor: "Ardesia TKF" }, 90, 38)).toEqual({
      sku: "VAN-URLH-SB/1DW/UG/X-35.4W-15H-19.7D-CAB-HPL-TKF-HDL-HPL-TKF",
      missing: [],
    });
  });

  it("spells the groove colour chosen for an Upper Groove cabinet as HDL, and None as the cabinet colour", () => {
    const withGroove = (HandleGrooveColor: string) =>
      cabinet({ CabinetColor: "Ardesia TKF", HandleGrooveColor }, 90, 38).sku;

    expect(withGroove("Castagno Malto 1C2")).toBe("VAN-URLH-SB/1DW/UG/X-35.4W-15H-19.7D-CAB-HPL-TKF-HDL-3D-1C2");
    expect(withGroove("None")).toBe("VAN-URLH-SB/1DW/UG/X-35.4W-15H-19.7D-CAB-HPL-TKF-HDL-HPL-TKF");
    // Push-to-Open has no groove, whatever colour the configuration still holds.
    expect(
      cabinet({ Handle: "handle_pto", CabinetColor: "Ardesia TKF", HandleGrooveColor: "Castagno Malto 1C2" }, 90, 35)
        .sku,
    ).toBe("VAN-URLH-SB/1DW/PTO/X-35.4W-13.8H-19.7D-CAB-HPL-TKF");
  });

  it("gives every groove colour of configurator 10 a material and a code", () => {
    const grooveColors = configurator.groupsByName["Select Handle Groove Color"].options.flatMap(({ variants }) =>
      variants.map(({ name }) => name),
    );

    expect(grooveColors.length).toBeGreaterThan(0);
    grooveColors.forEach((HandleGrooveColor) => {
      const { sku, missing } = cabinet({ CabinetColor: "Ardesia TKF", HandleGrooveColor }, 90, 38);
      expect(missing).toEqual([]);
      expect(sku).toMatch(/-HDL-[A-Z0-9]+-[A-Z0-9]+$/);
    });
  });

  /** The colours whose code differs from the one configurator 10 gives them, without its finish. */
  const wrongCodes = (section: string, codeOf: (name: string) => string | null) =>
    configurator.groupsByName[section].options.flatMap(({ variants }) =>
      variants.flatMap(({ name, metadata }) => {
        const given = metadata?.codeColor;
        if (typeof given !== "string") return [];
        const expected = given.split(" ")[0];
        const code = codeOf(name);
        return code === expected ? [] : [`${name}: ${code}, not ${expected}`];
      }),
    );

  // The profile names some codes and the number in a colour's name gives the rest: only this keeps that honest.
  it.each(["Select Cabinet Color", "Select Handle Groove Color", "Select Towel Bar Color"])(
    "spells every colour of %s with the code configurator 10 gives it",
    (section) => {
      expect(wrongCodes(section, (name) => resolveCollectionColorCode(skuProfile, name))).toEqual([]);
    },
  );

  // Priced as Urban Standard Height's, these read the code off the end of the name.
  it("reads the code of every vessel colour of configurator 10 off its name", () => {
    expect(wrongCodes("Select Vessel Color", extractColorCode)).toEqual([]);
  });

  it("reads the code of every countertop colour off its name but Matte White's, which ends in no code", () => {
    expect(wrongCodes("Select Countertop Color", extractColorCode)).toEqual(["Matte White: White, not MW"]);
  });

  it("spells push-to-open and fluting, and the lacquer code without its finish", () => {
    expect(
      cabinet(
        { Handle: "handle_pto", DrawerPanelFluting: "FlutingVerticalB", CabinetColor: "Arancio Zucca 09 MT" },
        105,
        35,
      ).sku,
    ).toBe("VAN-URLH-SB/1DW/PTO/CVB-41.3W-13.8H-19.7D-CAB-LACM-09");
  });

  it("carries Bianco 0B, which the price server prices in the White GL/MT column", () => {
    expect(
      cabinet({ CabinetType: "Side-Cabinet", Handle: "handle_pto", CabinetColor: "Bianco 0B MT" }, 60, 35).sku,
    ).toBe("VAN-URLH-SC/1DW/PTO/X-23.6W-13.8H-19.7D-CAB-LACM-0B");
  });

  it("reads the colour codes the name does not carry as a number", () => {
    const sideCabinet = (CabinetColor: string) =>
      cabinet({ CabinetType: "Side-Cabinet", Handle: "handle_pto", CabinetColor }, 25, 25, 46).sku;

    expect(sideCabinet("Castagno Malto 1C2")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-3D-1C2");
    expect(sideCabinet("Rovere Eucalipto 01A")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-ESS-01A");
    expect(sideCabinet("Metal acciaio 2MA")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-BM-2MA");
    expect(sideCabinet("Rosso Rubino 19 ST")).toBe("VAN-URLH-SC/1DW/PTO/X-9.8W-9.8H-18.1D-CAB-ST-19");
  });

  it("reads the legacy drawer spelling through the profile aliases, at the 28 cm height", () => {
    expect(cabinet({ Drawers: "1D", CabinetColor: "Castagno Malto 1C2" }, 120, 28).sku).toBe(
      "VAN-URLH-SB/1DW/UG/X-47.2W-11H-19.7D-CAB-3D-1C2-HDL-3D-1C2",
    );
  });

  it('spells the sink base and the open shelf of the 42" 1-Drawer 2 model as the price list does', () => {
    const cabinetOfModel = (CabinetType: string, widthCm: number) =>
      cabinet({ CabinetType, CabinetColor: "Cemento Cenere 1A1" }, widthCm, 38, 46).sku;

    expect(cabinetOfModel("Sink-Base", 80)).toBe("VAN-URLH-SB/1DW/UG/X-31.5W-15H-18.1D-CAB-3D-1A1-HDL-3D-1A1");
    // The open shelf has a series of its own and no drawer or handle, so no groove either.
    expect(cabinetOfModel("Open-Shelf", 25)).toBe("VAN-UROS-1S-9.8W-15H-18.1D-CAB-3D-1A1");
  });
});
