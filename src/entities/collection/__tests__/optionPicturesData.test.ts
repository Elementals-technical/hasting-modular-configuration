import { describe, expect, it } from "vitest";

import classProfileDocument from "../../../../public/collections/class/product-profile.json";
import classUi from "../../../../public/collections/class/ui.json";
import makoProfileDocument from "../../../../public/collections/mako/product-profile.json";
import makoUi from "../../../../public/collections/mako/ui.json";
import ushProfileDocument from "../../../../public/collections/urban-standard-height/product-profile.json";
import ushUi from "../../../../public/collections/urban-standard-height/ui.json";
import urbanLowHeightProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import urbanLowHeightUi from "../../../../public/collections/urban-low-height/ui.json";
import cabinetTable439 from "./fixtures/remote/datatable-439.json";
import cabinetTable579 from "./fixtures/remote/datatable-579.json";
import cabinetTable580 from "./fixtures/remote/datatable-580.json";
import cabinetTable581 from "./fixtures/remote/datatable-581.json";

import { buildCabinetCatalogFromMatrix } from "@/entities/product/lib/matrixCabinet";
import type { ProductDatatable } from "@/entities/product/api";

import { parseProductProfile } from "../lib/parseProductProfile";
import { selectOptions, selectOptionValues } from "../lib/productProfileSelectors";
import { validateCustomizationSchema } from "../lib/customization/validateCustomizationSchema";
import type { ProductProfile } from "../model/productProfile";

/**
 * A variant row names option values of the collection's own vocabulary. A typo in one would
 * silently never match and the card would fall back to its plain picture, which no other test
 * notices — so every `value` and every `when` entry is checked against the profile and the
 * cabinet catalog the collection actually loads.
 *
 * `Height` is checked against the catalog rather than the profile: USH declares no Height
 * attribute, its heights come from the cabinet table.
 */

const profileOf = (id: string, document: unknown): ProductProfile => {
  const result = parseProductProfile(document);
  if (!result.ok) throw new Error(`${id} profile must parse`);

  return result.profile;
};

const COLLECTIONS: { id: string; ui: unknown; profile: ProductProfile; table: unknown }[] = [
  {
    id: "urban-standard-height",
    ui: ushUi,
    profile: profileOf("urban-standard-height", ushProfileDocument),
    table: cabinetTable439,
  },
  {
    id: "urban-low-height",
    ui: urbanLowHeightUi,
    profile: profileOf("urban-low-height", urbanLowHeightProfileDocument),
    table: cabinetTable580,
  },
  { id: "class", ui: classUi, profile: profileOf("class", classProfileDocument), table: cabinetTable579 },
  { id: "mako", ui: makoUi, profile: profileOf("mako", makoProfileDocument), table: cabinetTable581 },
];

/** Option values of an attribute, including the legacy spellings that normalize to them. */
const knownValues = (profile: ProductProfile, attributeId: string) =>
  new Set(selectOptions(profile, attributeId).flatMap((option) => [option.value, ...(option.aliases ?? [])]));

describe("optionImages name values the collection declares", () => {
  it.each(COLLECTIONS)("$id", ({ id, ui, profile }) => {
    const result = validateCustomizationSchema(ui);
    if (!result.ok) throw new Error(`${id}: ui.json failed validation`);

    const unknown = Object.entries(result.schema.optionImages ?? {}).flatMap(([attributeId, byValue]) => {
      const known = knownValues(profile, attributeId);

      return Object.keys(byValue)
        .filter((value) => !known.has(value))
        .map((value) => `${attributeId}.${value}`);
    });

    expect(unknown).toEqual([]);
  });
});

describe("optionImageVariants name values the collection declares", () => {
  it.each(COLLECTIONS)("$id", ({ id, ui, profile, table }) => {
    const result = validateCustomizationSchema(ui);
    if (!result.ok) throw new Error(`${id}: ui.json failed validation`);

    const variants = result.schema.optionImageVariants;
    if (!variants) return;

    const catalog = buildCabinetCatalogFromMatrix(table as ProductDatatable, profile);
    const catalogHeights = new Set(catalog.typeCabinetRules.flatMap((rule) => rule.heights.map(String)));

    const unknown = Object.entries(variants).flatMap(([attributeId, rows]) =>
      rows.flatMap((row, index) => {
        const where = `${attributeId}[${index}]`;
        const found: string[] = [];

        if (!selectOptionValues(profile, attributeId).includes(row.value)) {
          found.push(`${where}.value: ${row.value}`);
        }

        for (const [conditionId, expected] of Object.entries(row.when)) {
          // "" means the attribute is not set, which every attribute allows.
          if (expected === "") continue;

          const known = conditionId === "Height" ? catalogHeights : new Set(selectOptionValues(profile, conditionId));

          if (!known.has(expected)) found.push(`${where}.when.${conditionId}: ${expected}`);
        }

        return found;
      }),
    );

    expect(unknown).toEqual([]);
  });
});
