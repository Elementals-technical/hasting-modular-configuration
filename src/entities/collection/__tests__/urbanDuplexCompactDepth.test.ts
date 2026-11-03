import { describe, expect, it } from "vitest";

import urbanDuplexPresetsDocument from "../../../../public/collections/urban-duplex/presets.json";

import { presetsSchema } from "../model/schemas";

import cabinetTable594 from "./fixtures/remote/datatable-594.json";

const compactPresets = presetsSchema.parse(urbanDuplexPresetsDocument).filter(({ rows }) => rows?.length);
const depthsByCabinetType = Object.fromEntries(
  cabinetTable594.rows.map(({ cabinet_type, depths_cm }) => [cabinet_type, depths_cm.split("|").map(Number)]),
);

describe("Urban Duplex compact preset depths", () => {
  it.each(compactPresets)("uses catalog depths for every cabinet of $title", ({ title, shared, rows }) => {
    for (const row of rows ?? []) {
      for (const product of row.products) {
        // Compact rows inherit shared values; a product's own value takes precedence at import.
        const effective = { ...shared, ...product };
        expect(depthsByCabinetType[product.name], `${title}: ${product.name}`).toContain(effective.Depth);
      }
    }
  });
});
