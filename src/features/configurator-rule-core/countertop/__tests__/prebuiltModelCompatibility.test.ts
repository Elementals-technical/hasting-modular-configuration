import { describe, expect, it } from "vitest";

import classPresetsDocument from "../../../../../public/collections/class/presets.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";
import urbanDuplexPresetsDocument from "../../../../../public/collections/urban-duplex/presets.json";
import urbanDuplexProfileDocument from "../../../../../public/collections/urban-duplex/product-profile.json";
import ushPresetsDocument from "../../../../../public/collections/urban-standard-height/presets.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import datatable438 from "@/entities/collection/__tests__/fixtures/remote/datatable-438.json";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import datatable595 from "@/entities/collection/__tests__/fixtures/remote/datatable-595.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { countertopDatatableSchema, presetsSchema } from "@/entities/collection/model/schemas";
import type { PresetProduct } from "@/entities/product/types";

import { parseCountertopMatrix } from "../parse";
import {
  REASON_MATERIAL_NOT_AVAILABLE_FOR_MODEL,
  resolvePrebuiltModelCountertopCompatibility,
} from "../prebuiltModelCompatibility";
import type { PrebuiltModelCountertopCompatibilityInput } from "../prebuiltModelCompatibility";

/**
 * Choosing another model keeps a vessel countertop the model can take. A collection's own vessels
 * (Iris, Frame, Plaza) are vessels as the Urban ones are, so a vessel top with one of them is judged
 * by the table's vessel limits, not as an integrated basin the table has no row for.
 */

const classProfile = (() => {
  const result = parseProductProfile(classProfileDocument);
  if (!result.ok) throw new Error("Class profile must parse");
  return result.profile;
})();

const urbanDuplexProfile = (() => {
  const result = parseProductProfile(urbanDuplexProfileDocument);
  if (!result.ok) throw new Error("Urban Duplex profile must parse");
  return result.profile;
})();

const firstModelOf = (presetsDocument: unknown) =>
  presetsSchema.parse(presetsDocument)[0].presetProducts as PresetProduct[];

const modelTitled = (presetsDocument: unknown, title: string) => {
  const model = presetsSchema.parse(presetsDocument).find((preset) => preset.title === title);
  if (!model) throw new Error(`${title} must be a shipped model`);
  return model.presetProducts as PresetProduct[];
};

/** Porcelain Avenue Amber TRC on the 48" model: a 50 cm Sink Cabinet beside a 70 cm Sink Base. */
const judgeUrbanDuplexPorcelain = (selection: Partial<PrebuiltModelCountertopCompatibilityInput>) =>
  resolvePrebuiltModelCountertopCompatibility({
    rules: parseCountertopMatrix(countertopDatatableSchema.parse(datatable595)),
    presetProducts: modelTitled(urbanDuplexPresetsDocument, 'Urban Duplex · 48" 2-Drawer'),
    activeMaterialTokens: ["Porcelain"],
    activeThickness: "0.5",
    profile: urbanDuplexProfile,
    ...selection,
  });

describe.each([
  ["Mako", makoProfile, datatable577, makoPresetsDocument],
  ["Class", classProfile, datatable578, classPresetsDocument],
] as const)("a %s vessel countertop and another model", (_name, profile, countertopTable, presetsDocument) => {
  it.each(["Iris", "Frame", "Plaza"])("keeps a black glass top with %s compatible", (vessel) => {
    const result = resolvePrebuiltModelCountertopCompatibility({
      rules: parseCountertopMatrix(countertopDatatableSchema.parse(countertopTable)),
      presetProducts: firstModelOf(presetsDocument),
      // The material tokens of Nero 433 GL.
      activeMaterialTokens: ["glass", "glassgl"],
      activeCountertopStyle: "vessel",
      activeBasinStyle: vessel,
      activeThickness: "0.5",
      profile,
    });

    expect(result.isCompatible).toBe(true);
  });
});

describe("an Urban Duplex porcelain countertop and a model with a 70 cm Sink Base", () => {
  it("refuses only the vessel style, with the vessel's Sink Base minimum", () => {
    const result = judgeUrbanDuplexPorcelain({ activeCountertopStyle: "vessel", activeBasinStyle: "Vessel" });

    expect(result).toEqual({
      isCompatible: false,
      refusal: "style",
      reasonCode: "countertop.vesselSinkBaseMin",
      reason: 'Not available for selected sink base cabinet width. Minimum width required 80cm (31.5")',
    });
  });

  it("keeps the porcelain top compatible with an integrated basin", () => {
    const result = judgeUrbanDuplexPorcelain({
      activeCountertopStyle: "integrated",
      activeBasinStyle: "Top_Porcelain_Strip",
    });

    expect(result).toEqual({ isCompatible: true });
  });

  it("refuses the material at a thickness no porcelain row offers", () => {
    const result = judgeUrbanDuplexPorcelain({
      activeCountertopStyle: "vessel",
      activeBasinStyle: "Vessel",
      activeThickness: "5.125",
    });

    expect(result).toMatchObject({
      isCompatible: false,
      refusal: "material",
      reasonCode: REASON_MATERIAL_NOT_AVAILABLE_FOR_MODEL,
    });
  });
});

describe("a Syntesi countertop and a two-cabinet model", () => {
  it("refuses the material", () => {
    const result = resolvePrebuiltModelCountertopCompatibility({
      rules: parseCountertopMatrix(countertopDatatableSchema.parse(datatable438)),
      presetProducts: modelTitled(ushPresetsDocument, 'Urban Standard · 42" 2-Drawer'),
      activeMaterialTokens: ["Syntesi"],
      activeCountertopStyle: "integrated",
      activeBasinStyle: null,
      activeThickness: "0.5",
      profile: ushProfile,
    });

    expect(result).toEqual({
      isCompatible: false,
      refusal: "material",
      reasonCode: REASON_MATERIAL_NOT_AVAILABLE_FOR_MODEL,
      reason: "The selected countertop material/finish is not available for this model.",
    });
  });
});
