import { describe, expect, it } from "vitest";

import type {
  CountertopFallbacksRuleData,
  ProductProfile,
  SyntesiRuleData,
  VesselCompatibilityRuleData,
} from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";

import { resolveCountertopCabinetCompositionConstraint } from "../compositionConstraints";
import { getMaterialAliases, materialMatchesRule } from "../parse";
import {
  isIntegratedCountertopDepthRestrictedByBasin,
  isIntegratedCountertopDepthRestrictedByMaterial,
} from "../sizeFilters";
import { findSyntesiCountertopUiValue, isSyntesiCountertopMaterialSku } from "../syntesiOptions";
import { isMaterialCompatibleWithVesselStyle, isVisibleVesselSinkStyle } from "../vesselCompatibility";

/**
 * Countertop product rules on the USH profile must behave as the constants they replaced did:
 * Syntesi composition, integrated depth restrictions and vessel compatibility. Another profile
 * changes the result without code. Material aliases stay in code for now.
 */

const USH_SYNTESI = ushProfile.ruleData.syntesi as SyntesiRuleData;
const USH_FALLBACKS = ushProfile.ruleData.countertopFallbacks as CountertopFallbacksRuleData;
const USH_VESSELS = ushProfile.ruleData.vesselCompatibility as VesselCompatibilityRuleData;

const withRuleData = (ruleData: Partial<ProductProfile["ruleData"]>): ProductProfile => ({
  ...ushProfile,
  ruleData: { ...ushProfile.ruleData, ...ruleData },
});

describe("resolveCountertopCabinetCompositionConstraint", () => {
  it("does not constrain a non-Syntesi countertop", () => {
    expect(
      resolveCountertopCabinetCompositionConstraint({
        materialTokens: ["tekorlux"],
        cabinetCount: 3,
        profile: ushProfile,
      }),
    ).toEqual({
      isSingleCabinetOnly: false,
      isWithinCabinetLimit: true,
      canAddCabinet: true,
      canRepositionCabinets: true,
    });
  });

  it.each([
    [0, { isWithinCabinetLimit: true, canAddCabinet: true, reason: undefined }],
    [
      1,
      {
        isWithinCabinetLimit: true,
        canAddCabinet: false,
        reason: "Syntesi is available for single cabinet configurations only.",
      },
    ],
    [
      2,
      {
        isWithinCabinetLimit: false,
        canAddCabinet: false,
        reason: "Syntesi is available for single cabinet configurations only.",
      },
    ],
  ])("limits Syntesi to one cabinet with %i placed", (cabinetCount, expected) => {
    expect(
      resolveCountertopCabinetCompositionConstraint({ materialTokens: ["Syntesi"], cabinetCount, profile: ushProfile }),
    ).toEqual({
      isSingleCabinetOnly: true,
      canRepositionCabinets: false,
      ...expected,
    });
  });

  it("recognises Syntesi only by its material name, not its SKU token", () => {
    expect(
      resolveCountertopCabinetCompositionConstraint({ materialTokens: ["SSSYN"], cabinetCount: 2, profile: ushProfile })
        .isSingleCabinetOnly,
    ).toBe(false);
  });

  it("follows the cabinet limit the collection declares", () => {
    const profile = withRuleData({ syntesi: { ...USH_SYNTESI, maxCabinetCount: 2 } });

    expect(
      resolveCountertopCabinetCompositionConstraint({ materialTokens: ["Syntesi"], cabinetCount: 1, profile }),
    ).toMatchObject({ isWithinCabinetLimit: true, canAddCabinet: true });
  });

  it("has no limit in a collection without Syntesi", () => {
    expect(
      resolveCountertopCabinetCompositionConstraint({
        materialTokens: ["Syntesi"],
        cabinetCount: 3,
        profile: withRuleData({ syntesi: undefined }),
      }),
    ).toMatchObject({ isSingleCabinetOnly: false, canAddCabinet: true });
  });
});

describe("Syntesi spellings", () => {
  it.each([
    ["Syntesi", true],
    ["SSSYN", true],
    ["sssyn", true],
    ["SSTKR", false],
    [null, false],
  ])("treats the material SKU %j as Syntesi: %j", (value, expected) => {
    expect(isSyntesiCountertopMaterialSku(value, ushProfile)).toBe(expected);
  });

  it.each([
    ["Bianco Gloss TAN", "Bianco Gloss TAN"],
    ["Bianco Gloss TAL", "Bianco Gloss TAN"],
    ["bianco matte tam", "Bianco Matte TAP"],
    ["Bianco Gloss", null],
  ])("resolves the finish spelled %j to %j", (value, expected) => {
    expect(findSyntesiCountertopUiValue(value, ushProfile)).toBe(expected);
  });

  it("knows no Syntesi in a collection without it", () => {
    const profile = withRuleData({ syntesi: undefined });

    expect(isSyntesiCountertopMaterialSku("SSSYN", profile)).toBe(false);
    expect(findSyntesiCountertopUiValue("Bianco Gloss TAL", profile)).toBeNull();
  });
});

describe("integrated countertop depth restrictions", () => {
  it.each([
    [["Tekormud"], 46, true],
    [["SST1C"], 46.005, true],
    [["solid surface"], 46, true],
    [["hpl"], 46, false],
    [["Tekormud"], 52, false],
    [["Tekormud"], null, false],
  ])("restricts materials %j at depth %j: %j", (activeMaterialTokens, depth, restricted) => {
    expect(isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens, depth, profile: ushProfile })).toBe(
      restricted,
    );
  });

  it.each([
    ["Top_Ocritech_Oly55", 46, true],
    ["Top_Ocritech_Orion", 46, true],
    ["Top_Tekorlux_Rectangular", 46, false],
    ["Top_Ocritech_Oly55", 52, false],
    [null, 46, false],
  ])("restricts the basin %j at depth %j: %j", (activeBasinStyle, depth, restricted) => {
    expect(isIntegratedCountertopDepthRestrictedByBasin({ activeBasinStyle, depth, profile: ushProfile })).toBe(
      restricted,
    );
  });

  it("follows the depths, materials and basins the collection declares", () => {
    const profile = withRuleData({
      countertopFallbacks: {
        ...USH_FALLBACKS,
        restrictedIntegratedDepthsCm: [52],
        restrictedIntegratedMaterialTokens: ["hpl"],
        restrictedIntegratedBasinKeys: ["rectangular"],
      },
    });

    expect(isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens: ["HPL"], depth: 52, profile })).toBe(
      true,
    );
    expect(
      isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens: ["Tekormud"], depth: 46, profile }),
    ).toBe(false);
    expect(
      isIntegratedCountertopDepthRestrictedByBasin({
        activeBasinStyle: "Top_Tekorlux_Rectangular",
        depth: 52,
        profile,
      }),
    ).toBe(true);
  });

  it("restricts nothing in a collection without fallbacks", () => {
    const profile = withRuleData({ countertopFallbacks: undefined });

    expect(
      isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens: ["Tekormud"], depth: 46, profile }),
    ).toBe(false);
    expect(
      isIntegratedCountertopDepthRestrictedByBasin({ activeBasinStyle: "Top_Ocritech_Oly55", depth: 46, profile }),
    ).toBe(false);
  });
});

describe("vessel compatibility", () => {
  it.each([
    ["Vessel_Blade11", true],
    ["Vessel_UrbanModo", true],
    ["Vessel_UrbanModo_Cover", false],
    ["Vessel_UrbanModo_Seam", false],
    ["Vessel_UrbanModo_Flat", false],
    ["Top_HPLPrisma", false],
    [null, false],
  ])("shows the vessel style %j: %j", (style, visible) => {
    expect(isVisibleVesselSinkStyle(style, ushProfile)).toBe(visible);
  });

  it.each([
    ["a non-vessel style", "Top_Tekorlux_Rectangular", ["hpl"], "TKF", true],
    ["ceramic on Blade", "Vessel_Blade11", ["ceramic"], null, true],
    ["another material on Blade", "Vessel_Blade18", ["tekorlux"], "TAL", false],
    ["an allowed Solid Surface colour on Urban Modo", "Vessel_UrbanModo", ["solidsurface"], "T1C", true],
    ["an alias of Solid Surface on Urban Modo", "Vessel_UrbanModo", ["ocritech"], "T1D", true],
    ["another Solid Surface colour on Urban Modo", "Vessel_UrbanModo", ["solidsurface"], "T1X", false],
    ["an allowed HPL colour through the style prefix", "Vessel_UrbanModo_Seam", ["hpl"], "TKF", true],
    ["an unavailable Porcelain colour on Urban Modo", "Vessel_UrbanModo", ["porcelain"], "TQ2", false],
    ["another Porcelain colour on Urban Modo", "Vessel_UrbanModo", ["porcelain"], "TQ1", true],
    ["Tekorlux TAM on Urban Morris", "Vessel_UrbanMorris", ["tekorlux"], "TAM", true],
    ["Tekorlux TAN on Urban Morris", "Vessel_UrbanMorris", ["tekorlux"], "TAN", false],
    ["any Tekorlux colour on Aquarius", "Vessel_Aquarius", ["sstkr"], "TAN", true],
  ])("decides %s", (_label, vesselStyle, materialTokens, colorCode, compatible) => {
    expect(isMaterialCompatibleWithVesselStyle({ vesselStyle, materialTokens, colorCode, profile: ushProfile })).toBe(
      compatible,
    );
  });

  it("follows the styles and materials the collection declares", () => {
    const profile = withRuleData({
      vesselCompatibility: {
        ...USH_VESSELS,
        hiddenStyles: [],
        allowedMaterialsByStyle: { Vessel_Blade11: ["tekorlux"] },
        allowedColorCodesByStyle: {},
        unavailableColorCodesByStyle: {},
      },
    });

    expect(isVisibleVesselSinkStyle("Vessel_UrbanModo_Cover", profile)).toBe(true);
    expect(
      isMaterialCompatibleWithVesselStyle({ vesselStyle: "Vessel_Blade11", materialTokens: ["tekorlux"], profile }),
    ).toBe(true);
    expect(
      isMaterialCompatibleWithVesselStyle({ vesselStyle: "Vessel_Blade11", materialTokens: ["ceramic"], profile }),
    ).toBe(false);
  });

  it("restricts nothing in a collection without the section", () => {
    const profile = withRuleData({ vesselCompatibility: undefined });

    expect(isVisibleVesselSinkStyle("Vessel_UrbanModo_Cover", profile)).toBe(true);
    expect(
      isMaterialCompatibleWithVesselStyle({ vesselStyle: "Vessel_Blade11", materialTokens: ["tekorlux"], profile }),
    ).toBe(true);
  });
});

describe("material aliases", () => {
  it.each([
    ["Tekormud", ["tekormud", "tekorund", "sstm"]],
    ["SSTKR", ["sstkr", "tekorlux", "tal", "tam"]],
    ["Fenix", ["fenix", "fx"]],
    ["HPL", ["hpl"]],
  ])("expands %j", (material, aliases) => {
    expect(getMaterialAliases(material)).toEqual(aliases);
  });

  it.each([
    ["SSTM", "Tekorund", true],
    ["Solid Surface", "SSOCR", true],
    ["Porcelain", "POR", true],
    ["HPL", "Fenix", false],
  ])("matches %j against the rule material %j: %j", (optionMaterial, ruleMaterial, matches) => {
    expect(materialMatchesRule(optionMaterial, ruleMaterial)).toBe(matches);
  });
});
