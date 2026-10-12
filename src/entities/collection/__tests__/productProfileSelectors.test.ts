import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import { parseProductProfile } from "../lib/parseProductProfile";
import type { ConfiguratorAvailableOption } from "@/entities/configurator/api/types";
import {
  isDrawerStyleMixingRestricted,
  isVesselBasin,
  parseConfiguratorSource,
  selectConfiguratorGroup,
  selectConfiguratorSection,
  selectMessage,
  selectRuleData,
} from "../lib/productProfileSelectors";
import type { ProductProfile } from "../model/productProfile";
import { makoProfile } from "./makoProfileFixture";
import { ushProfile } from "./ushProfileFixture";

const withMessages = (messages: Record<string, string>): ProductProfile => ({ ...ushProfile, messages });

describe("selectMessage", () => {
  it("returns the text of a reason code", () => {
    expect(selectMessage(ushProfile, "fluting.requiresLacquerMatte")).toBe(
      "Fluting is available only for Lacquer Matte (LACM).",
    );
  });

  it("falls back to the code itself when the collection has no text", () => {
    expect(selectMessage(ushProfile, "unknown.reason")).toBe("unknown.reason");
    expect(selectMessage(null, "fluting.requiresLacquerMatte")).toBe("fluting.requiresLacquerMatte");
  });

  it("substitutes params into placeholders", () => {
    const profile = withMessages({ "sidePanel.exactLength": 'Not available at exactly {lengthCm} cm ({lengthIn}").' });

    expect(selectMessage(profile, "sidePanel.exactLength", { lengthCm: 340, lengthIn: "133.9" })).toBe(
      'Not available at exactly 340 cm (133.9").',
    );
  });

  it("leaves a placeholder without a param visible", () => {
    const profile = withMessages({ "grain.excluded": "Not available for {material}: {finishes}." });

    expect(selectMessage(profile, "grain.excluded", { material: "HPL" })).toBe("Not available for HPL: {finishes}.");
  });
});

describe("isDrawerStyleMixingRestricted", () => {
  it.each([
    [[], "2", false],
    [["1"], "2", true],
    [["1"], "1+inner", false],
    [["1+inner"], "1", false],
    [["2"], "1", true],
    [["2"], "2", false],
    // One two-drawer cabinet makes the composition two-drawer, as before.
    [["1", "2"], "1", true],
    [["1", "2"], "2", false],
    // Scene spellings resolve through the catalog aliases.
    [["2D"], "1DWID", true],
    [["2"], "3", false],
  ])("restricts style %j after %j placed: %j", (placed, candidate, restricted) => {
    expect(isDrawerStyleMixingRestricted(ushProfile, placed, candidate)).toBe(restricted);
  });

  it("follows the groups the collection declares", () => {
    const allTogether: ProductProfile = {
      ...ushProfile,
      ruleData: { ...ushProfile.ruleData, drawerStyleGroups: [["1", "1+inner", "2"]] },
    };

    expect(isDrawerStyleMixingRestricted(allTogether, ["2"], "1")).toBe(false);
  });

  it("does not restrict in a collection without groups", () => {
    const noGroups: ProductProfile = {
      ...ushProfile,
      ruleData: { ...ushProfile.ruleData, drawerStyleGroups: undefined },
    };

    expect(isDrawerStyleMixingRestricted(noGroups, ["2"], "1")).toBe(false);
    expect(isDrawerStyleMixingRestricted(null, ["2"], "1")).toBe(false);
  });
});

describe("selectRuleData", () => {
  it("returns a declared rule section", () => {
    expect(selectRuleData(ushProfile, "syntesi")?.maxCabinetCount).toBe(1);
  });

  it("returns undefined for an undeclared section or without a profile", () => {
    const withoutVessels: ProductProfile = {
      ...ushProfile,
      ruleData: { ...ushProfile.ruleData, vesselCompatibility: undefined },
    };

    expect(selectRuleData(withoutVessels, "vesselCompatibility")).toBeUndefined();
    expect(selectRuleData(null, "fluting")).toBeUndefined();
  });
});

describe("isVesselBasin", () => {
  const parsed = (document: unknown) => {
    const result = parseProductProfile(document);
    if (!result.ok) throw new Error("profile must parse");
    return result.profile;
  };

  it.each([
    ["Urban Standard Height", ushProfile, ["Vessel_Blade11", "Vessel_UrbanModo_Flat", "Vessel_Iris", "Vessel_Frame"]],
    ["Urban Low Height", parsed(ulhProfileDocument), ["Vessel_Blade11", "Vessel_Aquarius"]],
    ["Mako", makoProfile, ["Iris", "Frame", "Plaza"]],
    ["Class", parsed(classProfileDocument), ["Iris", "Frame", "Plaza"]],
  ] as const)("reads the %s vessels from the profile, whatever their name", (_name, profile, vessels) => {
    vessels.forEach((value) => expect(isVesselBasin(profile, value)).toBe(true));
  });

  it.each([
    ["Urban Standard Height", ushProfile, ["Vessel", "Top_Tekorlux_Rectangular"]],
    ["Mako", makoProfile, ["None", "VA005"]],
  ] as const)(
    "leaves the %s cutout without a basin, an integrated basin and no basin out",
    (_name, profile, others) => {
      [...others, "", null, undefined].forEach((value) => expect(isVesselBasin(profile, value)).toBe(false));
    },
  );
});

describe("parseConfiguratorSource", () => {
  it.each([
    ["configurator:Select Cabinet Color", { group: "Select Cabinet Color" }],
    ["configurator:Select Cabinet Colors/Base Panel", { group: "Select Cabinet Colors", option: "Base Panel" }],
    ["configurator:Select Cabinet Colors/", { group: "Select Cabinet Colors" }],
    ["configurator:", null],
    ["configurator:/Base Panel", null],
    ["Select Cabinet Color", null],
    [undefined, null],
  ])("reads %j as %j", (source, expected) => {
    expect(parseConfiguratorSource(source)).toEqual(expected);
  });
});

describe("selectConfiguratorGroup", () => {
  const option = (id: number, name: string, colours: readonly string[]) => ({
    id,
    name,
    resource: null,
    paramString: null,
    playcanvasString: null,
    variants: colours.map((colour, index) => ({
      id: id * 100 + index,
      name: colour,
      image: null,
      enabled: true,
      description: "",
      metadata: { sku: "ST", Material: "Soft-Touch" },
    })),
  });
  // Urban Duplex's configurator 13 holds both panels in one group, an option each.
  const panels: ConfiguratorAvailableOption = {
    id: 1,
    proxyName: "Select Cabinet Colors",
    proxyType: "material",
    enabled: true,
    metadata: {},
    options: [option(2, "Base Panel", ["Nero 03 ST"]), option(3, "Lateral Panel", ["Bianco Calce DA ST"])],
  };
  const configurator = { groups: [panels] };
  const withSource = (optionsSource: string): ProductProfile => ({
    ...makoProfile,
    attributes: makoProfile.attributes.map((attribute) =>
      attribute.attributeId === "CabinetColor" ? { ...attribute, optionsSource } : attribute,
    ),
  });

  it("returns the whole group a source names", () => {
    expect(
      selectConfiguratorGroup(withSource("configurator:Select Cabinet Colors"), "CabinetColor", configurator),
    ).toBe(panels);
  });

  it("narrows the group to the option a source names, and keeps the group's name for the swatch order", () => {
    const profile = withSource("configurator:Select Cabinet Colors/Lateral Panel");

    expect(selectConfiguratorGroup(profile, "CabinetColor", configurator)).toEqual({
      ...panels,
      options: [panels.options[1]],
    });
    expect(selectConfiguratorSection(profile, "CabinetColor")).toBe("Select Cabinet Colors");
  });

  it("finds nothing for an unknown group or option, an attribute with its own options or no configurator", () => {
    const unknownGroup = withSource("configurator:Select Cabinet Color");
    const unknownOption = withSource("configurator:Select Cabinet Colors/Side Panel");
    const known = withSource("configurator:Select Cabinet Colors");

    expect(selectConfiguratorGroup(unknownGroup, "CabinetColor", configurator)).toBeUndefined();
    expect(selectConfiguratorGroup(unknownOption, "CabinetColor", configurator)).toBeUndefined();
    expect(selectConfiguratorGroup(makoProfile, "DividersStyle", configurator)).toBeUndefined();
    expect(selectConfiguratorGroup(known, "CabinetColor", null)).toBeUndefined();
  });
});
