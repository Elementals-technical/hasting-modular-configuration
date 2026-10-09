import { describe, expect, it } from "vitest";

import lamePresetsDocument from "../../../../public/collections/lame/presets.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { selectOptionValues } from "../lib/productProfileSelectors";
import { presetsSchema } from "../model/schemas";

/**
 * The Lame models with their compositions: Sink Base and Side Cabinet modules, 40–120 cm wide. No
 * document describes the compositions (GEN-MOD-01); they are read from the pre-render thumbnails the
 * models carry. A model's title names its width, style and legs; the filter tags follow what the
 * composition holds.
 */

const presets = presetsSchema.parse(lamePresetsDocument);

const parsedProfile = parseProductProfile(lameProfileDocument);
const profile = () => {
  if (!parsedProfile.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsedProfile.diagnostics)}`);
  return parsedProfile.profile;
};

const TITLE = /^Lame Vanity · (\d+)" (\d)-Drawer( Legs)?(?: \d+)?$/;

const titleOf = (title: string) => {
  const match = TITLE.exec(title);
  if (!match) throw new Error(`Unexpected Lame model title: ${title}`);
  return { inches: Number(match[1]), drawers: match[2], legs: Boolean(match[3]) };
};

/** Every file of the collection's image folder, keyed by its path from the collection folder. */
const shippedImages = new Set(
  Object.keys(import.meta.glob("/public/collections/lame/images/*", { query: "?url" })).map((path) =>
    path.replace("/public/collections/lame/", ""),
  ),
);

describe("lame model compositions", () => {
  it("gives every model a composition of Lame cabinet types", () => {
    const cabinetTypes = selectOptionValues(profile(), "CabinetType");

    // 44 models in the Master File; the pre-render has no thumbnail for Lame 79 2DW w/leg_70.
    expect(presets).toHaveLength(43);
    expect(new Set(presets.map(({ id }) => id)).size).toBe(presets.length);
    for (const { presetProducts } of presets) {
      expect(presetProducts.length).toBeGreaterThan(0);
      for (const { name } of presetProducts) expect(cabinetTypes).toContain(name);
    }
  });

  it("uses the widths of the price workbook and stays within 220 cm with at most two Sink Bases", () => {
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
      expect(presetProducts.filter(({ name }) => name === "Sink-Base").length, title).toBeLessThanOrEqual(2);
    }
  });

  it("gives each cabinet the height and drawers of the model's style, at the one Lame depth and handle", () => {
    for (const { title, presetProducts } of presets) {
      const { drawers } = titleOf(title);

      for (const product of presetProducts) {
        expect(product, title).toMatchObject({
          Height: drawers === "1" ? 26 : 52,
          Drawers: drawers === "1" ? "1D" : "2D",
          Depth: 52,
          Handle: "G58",
        });
      }
    }
  });

  it("paints every cabinet and its handles in the Antracite lacquer the thumbnails show", () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) {
        expect(product, title).toMatchObject({
          CabinetColor: "Antracite 400 MT",
          HandleColor: "Antracite 400 MT",
        });
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

  it("shows each model with its own thumbnail from the collection folder", () => {
    for (const { title, img } of presets) {
      expect(shippedImages.has(img), title).toBe(true);
      expect(img, title).toBe(`images/${title.replace('"', "_")}.png`);
    }
  });
});
