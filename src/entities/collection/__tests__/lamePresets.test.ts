import { describe, expect, it } from "vitest";

import lamePresetsDocument from "../../../../public/collections/lame/presets.json";
import lameProfileDocument from "../../../../public/collections/lame/product-profile.json";

import { parseProductProfile } from "../lib/parseProductProfile";
import { selectOptionValues } from "../lib/productProfileSelectors";
import { presetsSchema } from "../model/schemas";

import clientLayouts from "./fixtures/lame-client-layouts-2026-10-28.json";

/**
 * Cabinet order and basin positions are pinned to independently captured Hastings scenes (2026-10-28).
 * Raw inch annotations remain separate from nominal product widths in cm. Model 14 has unresolved
 * measurement endpoints, so its 51.1in overall label is not treated as a 120cm cabinet specification.
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
  it("covers every client model with one local preset", () => {
    expect(presets.map(({ id }) => id).sort((a, b) => a - b)).toEqual(
      clientLayouts.map(({ presetId }) => presetId).sort((a, b) => a - b),
    );
  });

  it.each(clientLayouts)("matches the client cabinet order, widths and basin positions of $title", (client) => {
    const preset = presets.find(({ id }) => id === client.presetId);
    expect(preset, client.sourceUrl).toBeDefined();
    if (!preset) throw new Error(`Missing local counterpart: ${client.sourceModel}`);
    expect(preset.title).toBe(client.title);
    expect(preset.presetProducts).toHaveLength(client.moduleTypes.length);
    preset.presetProducts.forEach((product, index) => {
      expect(product.name).toBe(client.moduleTypes[index] === "sink-base" ? "Sink-Base" : "Sink-Cabinet");
      expect(product.Drawers).toBe(`${client.drawersPerModule[index]}D`);
      if (!client.widthBasisUnresolved) {
        // One-decimal labels are not exact nominal dimensions (e.g.40cm appears as15.8in on Hastings).
        expect(Math.abs((product.Width ?? 0) / 2.54 - client.moduleWidthsIn[index]), client.sourceUrl).toBeLessThan(
          0.15,
        );
      }
    });
    expect(
      preset.presetProducts.flatMap((product, index) => (product.name === "Sink-Base" ? [index + 1] : [])),
    ).toEqual(client.basinPositions);
  });
  it("gives every model a composition of Lame cabinet types", () => {
    const cabinetTypes = selectOptionValues(profile(), "CabinetType");

    // The previously missing 79in 2-Drawer Legs now has a captured client reference and its own card.
    expect(presets).toHaveLength(44);
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

  // The scene lays Galles while a model names no pattern; the profile starts the composition at Oxford.
  it("lays every model in the starting pattern of the profile", () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) {
        expect(product.CabinetPattern, title).toBe(profile().defaults.CabinetPattern);
      }
    }
  });

  // The legs are on without a cap colour: the scene paints the caps in the handle colour.
  it("requests legs only for the models whose titles name them", () => {
    for (const { title, presetProducts } of presets) {
      for (const product of presetProducts) {
        expect(product.LegColor, title).toBe(titleOf(title).legs ? "None" : undefined);
      }
    }
    expect(presets.filter(({ title }) => titleOf(title).legs)).toHaveLength(19);
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
      expect(img.replace(/\.[^./]+$/, ""), title).toBe(`images/${title.replace('"', "_")}`);
    }
  });
});
