import { describe, expect, it } from "vitest";

import makoPresetsDocument from "../../../../public/collections/mako/presets.json";

import { normalizeOptionValue, selectOptionValues } from "../lib/productProfileSelectors";
import { resolveProductConfig } from "../lib/runtimeBindings/resolveProductConfig";
import { makoRuntimeBindings } from "../lib/runtimeBindings/__tests__/makoRuntimeBindingsFixture";
import { presetsSchema } from "../model/schemas";

import { makoProfile } from "./makoProfileFixture";

/**
 * The 42 Mako models with their compositions (MAKO_MODEL_PRESET_MODULES): Sink Base and Side
 * Cabinet modules, 40–120 cm wide. A model's title names its width, style and legs; the
 * filter tags follow what the composition holds.
 */

const presets = presetsSchema.parse(makoPresetsDocument);

const TITLE = /^Mako Vanity · (\d+)" (\d)-Drawer( Legs)?(?: \d+)?$/;

const titleOf = (title: string) => {
  const match = TITLE.exec(title);
  if (!match) throw new Error(`Unexpected Mako model title: ${title}`);
  return { inches: Number(match[1]), drawers: match[2], legs: Boolean(match[3]) };
};

describe("mako model compositions", () => {
  it("gives every model a composition of Mako cabinet types", () => {
    const cabinetTypes = selectOptionValues(makoProfile, "CabinetType");

    expect(presets).toHaveLength(42);
    for (const { presetProducts } of presets) {
      expect(presetProducts.length).toBeGreaterThan(0);
      for (const { name } of presetProducts) expect(cabinetTypes).toContain(name);
    }
  });

  it("uses the confirmed widths and stays within 220 cm (map section 3)", () => {
    for (const { title, presetProducts } of presets) {
      const widths = presetProducts.map(({ Width }) => Width ?? 0);

      for (const { name, Width } of presetProducts) {
        expect([40, 60, 80, 100, 120]).toContain(Width);
        if (name === "Sink-Base") expect(Width).toBeGreaterThanOrEqual(60);
      }

      const total = widths.reduce((sum, width) => sum + width, 0);
      expect(total, title).toBeLessThanOrEqual(220);
      // The title names the width in whole inches (80 cm, 31.5", is a 32" model).
      expect(Math.abs(total / 2.54 - titleOf(title).inches), title).toBeLessThanOrEqual(1);
    }
  });

  it("gives each cabinet the height and drawers of the model's style, at the one Mako depth", () => {
    for (const { title, presetProducts } of presets) {
      const { drawers } = titleOf(title);

      for (const product of presetProducts) {
        expect(product, title).toMatchObject({
          Height: drawers === "1" ? 26 : 52,
          Drawers: drawers === "1" ? "1D" : "2D",
          Depth: 52,
        });
      }
    }
  });

  it("paints every cabinet and its handles in the scene's Mako colour until the product names the models' colours", () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) {
        expect(product, title).toMatchObject({
          CabinetColor: "Antracite Matte OCF",
          HandleColor: "Antracite Matte OCF",
        });
      }
    }
  });

  it("puts legs, in the cabinet colour, only on the models that have them and only on 2DW", () => {
    for (const { title, presetProducts } of presets) {
      const { drawers, legs } = titleOf(title);
      if (legs) expect(drawers, title).toBe("2");

      for (const product of presetProducts) {
        expect(product.LegColor, title).toBe(legs ? "None" : undefined);
      }
    }
  });

  it("tags each model by what its composition holds", () => {
    for (const { title, presetProducts, style } of presets) {
      const sinkBases = presetProducts.filter(({ name }) => name === "Sink-Base").length;
      const sequence = presetProducts.map(({ name, Width }) => `${name}:${Width}`);
      const symmetric = sequence.join() === [...sequence].reverse().join();

      expect(style, title).toContain(sinkBases === 2 ? "double_basin" : "single_basin");
      expect(style.includes("asymmetrical"), title).toBe(!symmetric);
      expect(style, title).toContain(`${titleOf(title).drawers}_drawer`);
    }
  });

  it("reaches the scene as Mako products, on legs only where the model has them", () => {
    for (const { title, presetProducts } of presets) {
      const { legs } = titleOf(title);

      for (const { name, ...config } of presetProducts) {
        // C sends the drawer style as its canonical option ("1D" -> "1"), which the bindings map.
        const drawers = normalizeOptionValue(makoProfile, "Drawers", config.Drawers);

        expect(makoRuntimeBindings.productTypes[name]).toMatch(/^Mako-(sink|side)-cabinet$/);
        expect(resolveProductConfig(makoRuntimeBindings, { ...config, Drawers: drawers }), title).toMatchObject({
          CabinetColor: "Antracite Matte OCF",
          HandleColor: "Antracite Matte OCF",
          HandleStyle: "G57",
          ShowLegs: legs ? "Enable" : "Disable",
        });
      }
    }
  });
});
