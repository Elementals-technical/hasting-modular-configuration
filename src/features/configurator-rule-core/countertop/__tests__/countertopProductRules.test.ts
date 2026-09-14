import { describe, expect, it } from "vitest";

import { resolveCountertopCabinetCompositionConstraint } from "../compositionConstraints";
import { getMaterialAliases, materialMatchesRule } from "../parse";
import {
  isIntegratedCountertopDepthRestrictedByBasin,
  isIntegratedCountertopDepthRestrictedByMaterial,
} from "../sizeFilters";
import { isMaterialCompatibleWithVesselStyle, isVisibleVesselSinkStyle } from "../vesselCompatibility";

/**
 * Current behaviour of the countertop product rules that are still constants in code:
 * Syntesi composition, integrated depth restrictions, vessel compatibility and material
 * aliases. Recorded before their parameters move into the collection profile.
 */

describe("resolveCountertopCabinetCompositionConstraint", () => {
  it("does not constrain a non-Syntesi countertop", () => {
    expect(resolveCountertopCabinetCompositionConstraint({ materialTokens: ["tekorlux"], cabinetCount: 3 })).toEqual({
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
    expect(resolveCountertopCabinetCompositionConstraint({ materialTokens: ["Syntesi"], cabinetCount })).toEqual({
      isSingleCabinetOnly: true,
      canRepositionCabinets: false,
      ...expected,
    });
  });

  it("recognises Syntesi only by its material name, not its SKU token", () => {
    expect(
      resolveCountertopCabinetCompositionConstraint({ materialTokens: ["SSSYN"], cabinetCount: 2 }).isSingleCabinetOnly,
    ).toBe(false);
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
    expect(isIntegratedCountertopDepthRestrictedByMaterial({ activeMaterialTokens, depth })).toBe(restricted);
  });

  it.each([
    ["Top_Ocritech_Oly55", 46, true],
    ["Top_Ocritech_Orion", 46, true],
    ["Top_Tekorlux_Rectangular", 46, false],
    ["Top_Ocritech_Oly55", 52, false],
    [null, 46, false],
  ])("restricts the basin %j at depth %j: %j", (activeBasinStyle, depth, restricted) => {
    expect(isIntegratedCountertopDepthRestrictedByBasin({ activeBasinStyle, depth })).toBe(restricted);
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
    expect(isVisibleVesselSinkStyle(style)).toBe(visible);
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
    expect(isMaterialCompatibleWithVesselStyle({ vesselStyle, materialTokens, colorCode })).toBe(compatible);
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
