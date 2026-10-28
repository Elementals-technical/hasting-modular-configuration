import { describe, expect, it } from "vitest";

import {
  parseProductProfile,
  type CountertopFallbacksRuleData,
  type ProductProfile,
  type SyntesiRuleData,
  type VesselCompatibilityRuleData,
} from "@/entities/collection";
import datatable589 from "@/entities/collection/__tests__/fixtures/remote/datatable-589.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { countertopDatatableSchema } from "@/entities/collection/model/schemas";
import ulhProfileDocument from "../../../../../public/collections/urban-low-height/product-profile.json";

import { resolveCountertopCabinetCompositionConstraint } from "../compositionConstraints";
import { evaluateCountertopMaterial } from "../materialAvailability";
import { getMaterialAliases, materialMatchesRule, parseCountertopMatrix } from "../parse";
import { buildCountertopRuleState } from "../rules";
import {
  isIntegratedCountertopDepthRestrictedByBasin,
  isIntegratedCountertopDepthRestrictedByMaterial,
} from "../sizeFilters";
import { findSyntesiCountertopUiValue, isSyntesiCountertopMaterialSku } from "../syntesiOptions";
import {
  getAllowedVesselMaterialTokens,
  isMaterialCompatibleWithVesselStyle,
  isPreferredVesselFinish,
  isVisibleVesselSinkStyle,
} from "../vesselCompatibility";

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
    // Legacy vessels kept in the catalog for old orders only.
    ["Vessel_Iris", false],
    ["Vessel_Frame", false],
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

// Mako's vessels take the lacquers of their palettes, as the price list and the Threekit tables give them.
describe("Mako vessel colours", () => {
  it.each([
    ["Iris", ["Lacquered MT"], "415", true],
    ["Iris", ["Lacquered GL"], "433", false],
    ["Iris", ["Glass MT"], "406", false],
    ["Frame", ["Lacquered MT"], "401", true],
    ["Frame", ["Porcelain"], null, false],
    ["Plaza", ["Lacquered MT"], "400", true],
    ["Plaza", ["Lacquered GL"], "433", true],
    ["Plaza", ["Smoke Glass"], null, false],
  ])("decides %s in %j %s: %j", (vesselStyle, materialTokens, colorCode, compatible) => {
    expect(isMaterialCompatibleWithVesselStyle({ vesselStyle, materialTokens, colorCode, profile: makoProfile })).toBe(
      compatible,
    );
  });

  it.each(["None", "", "VA005"])("restricts no colour for %j, which is not a vessel", (basin) => {
    expect(getAllowedVesselMaterialTokens(basin, makoProfile)).toBeNull();
  });

  it.each([
    ["Iris", "415"],
    ["Frame", "401"],
    ["Plaza", "400"],
  ])("starts %s at the lacquered matt %s", (vesselStyle, colorCode) => {
    expect(
      isPreferredVesselFinish({ vesselStyle, materialTokens: ["Lacquered MT"], colorCode, profile: makoProfile }),
    ).toBe(true);
    expect(
      isPreferredVesselFinish({ vesselStyle, materialTokens: ["Lacquered GL"], colorCode, profile: makoProfile }),
    ).toBe(false);
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

// Client rules: off its Sink Base the basin rides a top that lifts (5⅛″ or 5½″, 22.10), or a 4″ one under a vessel
// (27.10). What may float is the collection's data: Urban Low Height's Thickness options declare `countertopLifts`
// and, on 4″, `countertopCarriesVessel`.
describe("a basin with no Sink Base under it", () => {
  const rules = parseCountertopMatrix(countertopDatatableSchema.parse(datatable589));
  const ulhProfile: ProductProfile = (() => {
    const parsed = parseProductProfile(ulhProfileDocument);
    if (!parsed.ok) throw new Error("The Urban Low Height profile failed validation");
    return parsed.profile;
  })();
  const thicknessesOf = (material: string, depth: number, activeCountertopStyle: string, sinkOffSinkBase?: boolean) =>
    [
      ...buildCountertopRuleState({
        rules,
        activeMaterialTokens: [material],
        width: 80,
        depth,
        activeCountertopStyle,
        activeBasinStyle: null,
        activeThickness: null,
        profile: ulhProfile,
        sinkOffSinkBase,
      }).allowedThicknesses,
    ].sort((left, right) => left - right);

  // Table 589: HPL is 1/2", 4" or 5-1/8"; Porcelain 1/2", 2-3/8", 4" or 5-1/2".
  it("keeps only the top that lifts over an integrated sink off its Sink Base", () => {
    expect(thicknessesOf("HPL", 46, "integrated")).toEqual([0.5, 4, 5.125]);
    expect(thicknessesOf("HPL", 46, "integrated", true)).toEqual([5.125]);
    expect(thicknessesOf("Porcelain", 46, "integrated")).toEqual([0.5, 2.4, 4, 5.5]);
    expect(thicknessesOf("Porcelain", 46, "integrated", true)).toEqual([5.5]);
  });

  it("keeps the 4″ top as well over a vessel off its Sink Base", () => {
    expect(thicknessesOf("HPL", 46, "vessel")).toEqual([0.5, 4, 5.125]);
    expect(thicknessesOf("HPL", 46, "vessel", true)).toEqual([4, 5.125]);
    expect(thicknessesOf("Porcelain", 46, "vessel")).toEqual([0.5, 2.4, 4, 5.5]);
    expect(thicknessesOf("Porcelain", 46, "Vessel", true)).toEqual([4, 5.5]);
  });

  it("leaves a material with thin tops only no thickness there", () => {
    expect(thicknessesOf("Glass", 50, "integrated")).toEqual([0.375]);
    expect(thicknessesOf("Glass", 50, "integrated", true)).toEqual([]);
    expect(thicknessesOf("Mineralmarmo", 50, "integrated")).toEqual([0.5]);
    expect(thicknessesOf("Mineralmarmo", 50, "integrated", true)).toEqual([]);
  });

  it("lets no thickness float in a collection whose options do not lift", () => {
    const ushThicknesses = buildCountertopRuleState({
      rules,
      activeMaterialTokens: ["HPL"],
      width: 80,
      depth: 46,
      activeCountertopStyle: "integrated",
      activeBasinStyle: null,
      activeThickness: null,
      profile: ushProfile,
      sinkOffSinkBase: true,
    }).allowedThicknesses;
    expect([...ushThicknesses]).toEqual([]);
  });

  const colourOf = (material: string, depth: number, sinkOffSinkBase?: boolean, activeCountertopStyle = "integrated") =>
    evaluateCountertopMaterial([material], {
      activeBasinStyle: null,
      activeCountertopStyle,
      activeProfile: ulhProfile,
      cabinetCompositionCount: 1,
      countertopRules: rules,
      depth,
      sinkBaseWidth: 80,
      sinkOffSinkBase,
      totalWidth: 80,
    });

  it("refuses the colours of a material without such a top, and only while the basin is off its Sink Base", () => {
    for (const thinOnly of ["Glass", "Mineralmarmo", "Syntesi"]) {
      expect(colourOf(thinOnly, 50)).toEqual({ isCompatible: true, failedBy: null });
      expect(colourOf(thinOnly, 50, true)).toEqual({ isCompatible: false, failedBy: "offSinkBase" });
    }
    for (const lifting of ["HPL", "Fenix", "Porcelain", "Tekorlux", "Ocritech"])
      expect(colourOf(lifting, 50, true)).toEqual({ isCompatible: true, failedBy: null });
  });

  it("judges a vessel off its Sink Base by its 4″ rows as well", () => {
    // A material with a 4″ row only (no 5-1/8″ or 5-1/2″): a vessel may ride it off its Sink Base, an integrated basin not.
    const fourOnly = [
      { ...rules.find((rule) => rule.material === "HPL")!, material: "FourOnly", topThicknesses: ["4"] },
    ];
    const fourOnlyOf = (style: string) =>
      evaluateCountertopMaterial(["FourOnly"], {
        activeBasinStyle: null,
        activeCountertopStyle: style,
        activeProfile: ulhProfile,
        cabinetCompositionCount: 1,
        countertopRules: fourOnly,
        depth: 46,
        sinkBaseWidth: null,
        sinkOffSinkBase: true,
        totalWidth: null,
      });
    expect(fourOnlyOf("vessel")).toEqual({ isCompatible: true, failedBy: null });
    expect(fourOnlyOf("integrated")).toEqual({ isCompatible: false, failedBy: "offSinkBase" });
    // Thin-only materials stay out under a vessel too.
    expect(colourOf("Glass", 50, true, "vessel")).toEqual({ isCompatible: false, failedBy: "offSinkBase" });
  });

  it("names the floating top before the depth for a material that lifts at no depth, the depth for one that lifts elsewhere", () => {
    // Glass is 3/8" only, and 50 cm deep only: lowering the top would not make it at 46 cm either.
    expect(colourOf("Glass", 46)).toEqual({ isCompatible: false, failedBy: "depth" });
    expect(colourOf("Glass", 46, true)).toEqual({ isCompatible: false, failedBy: "offSinkBase" });
    // Tekorund lifts (5-1/8"), but an integrated Tekorund top is 50 cm deep only.
    expect(colourOf("Tekorund", 46)).toEqual({ isCompatible: false, failedBy: "depth" });
    expect(colourOf("Tekorund", 46, true)).toEqual({ isCompatible: false, failedBy: "depth" });
  });
});
