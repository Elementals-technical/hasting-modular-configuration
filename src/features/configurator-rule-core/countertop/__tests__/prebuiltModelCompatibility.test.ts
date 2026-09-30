import { describe, expect, it } from "vitest";

import classPresetsDocument from "../../../../../public/collections/class/presets.json";
import classProfileDocument from "../../../../../public/collections/class/product-profile.json";
import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import datatable577 from "@/entities/collection/__tests__/fixtures/remote/datatable-577.json";
import datatable578 from "@/entities/collection/__tests__/fixtures/remote/datatable-578.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { countertopDatatableSchema, presetsSchema } from "@/entities/collection/model/schemas";
import type { PresetProduct } from "@/entities/product/types";

import { parseCountertopMatrix } from "../parse";
import { resolvePrebuiltModelCountertopCompatibility } from "../prebuiltModelCompatibility";

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

const firstModelOf = (presetsDocument: unknown) =>
  presetsSchema.parse(presetsDocument)[0].presetProducts as PresetProduct[];

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
