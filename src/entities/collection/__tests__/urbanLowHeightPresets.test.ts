import { describe, expect, it } from "vitest";

import ulhPresetsDocument from "../../../../public/collections/urban-low-height/presets.json";
import ulhProfileDocument from "../../../../public/collections/urban-low-height/product-profile.json";
import ulhSkuProfileDocument from "../../../../public/collections/urban-low-height/sku-profile.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { normalizeOptionValue, selectOptionValues } from "../lib/productProfileSelectors";
import { resolveProductConfig } from "../lib/runtimeBindings/resolveProductConfig";
import { ulhRuntimeBindings } from "../lib/runtimeBindings/__tests__/ulhRuntimeBindingsFixture";
import { collectionSkuProfileSchema, presetsSchema } from "../model/schemas";
import ulhClientPresets from "./fixtures/ulh-client-presets-2026-10-30.json";

/**
 * The 59 Urban Low Height models with their compositions (URBAN_LOW_HEIGHT_MODEL_PRESET_MODULES):
 * Sink Base, Side Cabinet and Open Shelf modules left to right, the price-list inches in the map's
 * centimetres (§3). Client Dimensions distinguish the 26 low linear models from the 27 standard
 * ones; the six Multi-Level recipes carry two rows of 28 cm modules. Presets use the deeper ULH
 * option requested by the product owner: 50 cm (19.7"). Compact row offsets are the approved nominal
 * reconstruction from rounded client labels, not exact client mesh measurements.
 */

const presets = presetsSchema.parse(ulhPresetsDocument);
const ulhSkuProfile = collectionSkuProfileSchema.parse(ulhSkuProfileDocument);

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

const presetOf = (id: number) => {
  const preset = presets.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Missing Urban Low Height preset ${id}`);
  return preset;
};

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

  it('uses the upper groove and the requested 19.7" depth on flat cabinets', () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) {
        expect(product.Depth, title).toBe(50);

        if (product.name === "Open-Shelf") {
          expect(product.Handle, title).toBeUndefined();
          expect(product.Drawers, title).toBeUndefined();
        } else {
          expect(product, title).toMatchObject({ Handle: "handle_urban_topcut", Drawers: "1D" });
        }
      }
    }
  });

  it.each(ulhClientPresets.linearPresets)("matches the client module order and nominal sizes of $title", (source) => {
    const preset = presetOf(source.id);
    expect(preset.title).toBe(source.title);
    expect(preset.presetProducts.map(({ name, Width, Height, Depth }) => ({ name, Width, Height, Depth }))).toEqual(
      source.products.map(({ name, widthCm }) => ({
        name,
        Width: widthCm,
        Height: source.heightCm,
        Depth: source.depthCm,
      })),
    );
  });

  it.each(ulhClientPresets.multiLevelPresets)(
    "matches the client modules and approved nominal row placement of $title",
    (source) => {
      const preset = presetOf(source.id);
      expect(preset.title).toBe(source.title);
      expect(preset.shared).toMatchObject({ Height: source.heightCm, Depth: source.depthCm });
      expect(preset.shared).not.toHaveProperty("Width");

      expect(
        preset.rows?.map((row) => ({
          elevationCm: row.elevation ?? 0,
          offsetXCm: row.offsetX ?? 0,
          products: row.products.map(({ name, Width }) => ({ name, widthCm: Width })),
        })),
      ).toEqual(source.rows);

      for (const row of preset.rows ?? []) {
        for (const product of row.products) {
          expect(resolveProductConfig(ulhRuntimeBindings, { ...preset.shared, ...product })).toMatchObject({
            Width: product.Width,
            Height: source.heightCm,
            Depth: source.depthCm,
          });
        }
      }
    },
  );

  it.each(presets.filter(({ title }) => isMultiLevel(title)))(
    'sets the requested 19.7" depth explicitly on every compact module of $title',
    ({ title, shared, rows }) => {
      // Compact recipes otherwise inherit the scene product's shallower default depth.
      expect(shared, title).toMatchObject({ Depth: 50 });
      expect(rows?.length, title).toBeGreaterThan(0);

      for (const row of rows ?? []) {
        for (const product of row.products) {
          const config = { ...shared, ...product };
          expect(config.Depth, title).toBe(50);
          expect(resolveProductConfig(ulhRuntimeBindings, config).Depth, title).toBe(50);
        }
      }
    },
  );

  it("paints every module of the models in Rox Black TKQ, an HPL colour the collection prices by its code", () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) expect(product.CabinetColor, title).toBe("Rox Black TKQ");
    }
    // The name carries no number, so the cabinet SKU takes its code (`CAB-HPL-TKQ`) from the profile.
    expect(ulhSkuProfile.colors.codeByValue["Rox Black TKQ"]).toBe("TKQ");
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
    for (const source of ulhClientPresets.linearPresets) {
      const { title, presetProducts } = presetOf(source.id);
      for (const { name, ...config } of presetProducts) {
        // C sends the drawer style as its canonical option ("1D" -> "1"), which the bindings map.
        const drawers = normalizeOptionValue(ulhProfile(), "Drawers", config.Drawers);

        expect(ulhRuntimeBindings.productTypes[name], title).toMatch(/^ULH-/);
        expect(resolveProductConfig(ulhRuntimeBindings, { ...config, Drawers: drawers }), title).toMatchObject({
          Width: config.Width,
          Height: source.heightCm,
          Depth: 50,
          CabinetColor: "Rox Black TKQ",
          ...(name === "Open-Shelf" ? {} : { Handle: "handle_urban_topcut", Drawers: "1D" }),
        });
      }
    }
  });
});
