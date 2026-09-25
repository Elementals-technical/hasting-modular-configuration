import { describe, expect, it } from "vitest";

import ulhPresetsDocument from "../../../../public/collections/urban-low-height/presets.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { normalizeOptionValue, selectOptionValues } from "../lib/productProfileSelectors";
import { resolveProductConfig } from "../lib/runtimeBindings/resolveProductConfig";
import { ulhRuntimeBindings } from "../lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { presetsSchema } from "../model/schemas";

/**
 * The 59 Urban Low Height models with their compositions (URBAN_LOW_HEIGHT_MODEL_PRESET_MODULES):
 * Sink Base, Side Cabinet and Open Shelf modules left to right, the price-list inches in the map's
 * centimetres (§3). Every module stands at 38 cm with the upper groove and 46 cm deep until the product
 * names each model's height and handle. The six Multi-Level models hang at two wall heights, which the
 * scene cannot place yet, so they keep no composition.
 */

const presets = presetsSchema.parse(ulhPresetsDocument);

const parsed = parseProductProfile(ulhProfileDocument);
const ulhProfile = () => {
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

const TITLE = /^Urban Low Height · (\d+)" 1-Drawer(?: .+)?$/;

const inchesOf = (title: string) => {
  const match = TITLE.exec(title);
  if (!match) throw new Error(`Unexpected Urban Low Height model title: ${title}`);
  return Number(match[1]);
};

const isMultiLevel = (title: string) => title.endsWith("Multi-Level");

// Cabinet table 580 (§3); an Open Shelf reaches 70 cm at 38 cm high.
const WIDTHS: Record<string, number[]> = {
  "Sink-Base": [60, 70, 80, 90, 105, 120],
  "Side-Cabinet": [25, 35, 50, 60, 70, 80, 90, 105, 120],
  "Open-Shelf": [25, 35, 50, 60, 70],
};

describe("urban-low-height model compositions", () => {
  it("gives every model but the Multi-Level ones a composition of placeable cabinet types", () => {
    expect(presets).toHaveLength(59);

    for (const { title, presetProducts } of presets) {
      if (isMultiLevel(title)) {
        expect(presetProducts, title).toEqual([]);
        continue;
      }

      expect(presetProducts.length, title).toBeGreaterThan(0);
      for (const { name } of presetProducts) {
        expect(selectOptionValues(ulhProfile(), "CabinetType")).toContain(name);
        expect(Object.keys(ulhRuntimeBindings.productTypes)).toContain(name);
      }
    }
  });

  it("uses the widths of the cabinet table and adds up to the width the title names", () => {
    for (const { title, presetProducts } of presets) {
      if (isMultiLevel(title)) continue;

      for (const { name, Width } of presetProducts) expect(WIDTHS[name], title).toContain(Width);

      const total = presetProducts.reduce((sum, { Width }) => sum + (Width ?? 0), 0);
      // The title names the width in whole inches (105 cm is 41.3").
      expect(Math.abs(total / 2.54 - inchesOf(title)), title).toBeLessThanOrEqual(1);
    }
  });

  it("stands every module at 38 cm with the upper groove, 46 cm deep, with the one drawer on cabinets", () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) {
        expect(product, title).toMatchObject({ Height: 38, Depth: 46 });

        if (product.name === "Open-Shelf") {
          expect(product.Handle, title).toBeUndefined();
          expect(product.Drawers, title).toBeUndefined();
        } else {
          expect(product, title).toMatchObject({ Handle: "handle_urban_topcut", Drawers: "1D" });
        }
      }
    }
  });

  it("tags each model by what its composition holds", () => {
    for (const { title, presetProducts, style } of presets) {
      if (isMultiLevel(title)) {
        expect(style, title).toContain("multi_level");
        continue;
      }

      const sinkBases = presetProducts.filter(({ name }) => name === "Sink-Base").length;
      const sequence = presetProducts.map(({ name, Width }) => `${name}:${Width}`);
      const symmetric = sequence.join() === [...sequence].reverse().join();

      expect(style, title).toContain(sinkBases === 2 ? "double_basin" : "single_basin");
      expect(style.includes("asymmetrical"), title).toBe(!symmetric);
      expect(style.includes("open_shelving"), title).toBe(presetProducts.some(({ name }) => name === "Open-Shelf"));
      expect(style.includes("multi_level"), title).toBe(false);
    }
  });

  it("reaches the scene as ULH products with the keys the ULH scene reads", () => {
    for (const { title, presetProducts } of presets) {
      for (const { name, ...config } of presetProducts) {
        // C sends the drawer style as its canonical option ("1D" -> "1"), which the bindings map.
        const drawers = normalizeOptionValue(ulhProfile(), "Drawers", config.Drawers);

        expect(ulhRuntimeBindings.productTypes[name], title).toMatch(/^ULH-/);
        expect(resolveProductConfig(ulhRuntimeBindings, { ...config, Drawers: drawers }), title).toMatchObject({
          Width: config.Width,
          Height: 38,
          Depth: 46,
          ...(name === "Open-Shelf" ? {} : { Handle: "handle_urban_topcut", Drawers: "1D" }),
        });
      }
    }
  });
});
