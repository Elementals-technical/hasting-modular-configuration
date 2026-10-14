import { describe, expect, it } from "vitest";

import sceneCode from "../../../../public/HastingCabinetsParametrization/js/esm.mjs?raw";
import urbanDuplexPresetsDocument from "../../../../public/collections/urban-duplex/presets.json";
import urbanDuplexProfileDocument from "../../../../public/collections/urban-duplex/product-profile.json";
import urbanDuplexBindingsDocument from "../../../../public/collections/urban-duplex/runtime-bindings.json";

import { normalizeHandleProfile } from "../lib/normalizeHandleProfile";
import { parseProductProfile } from "../lib/parseProductProfile";
import { normalizeOptionValue, selectOptionValues } from "../lib/productProfileSelectors";
import { parseRuntimeBindings } from "../lib/runtimeBindings/parseRuntimeBindings";
import { presetsSchema } from "../model/schemas";

import cabinetTable594 from "./fixtures/remote/datatable-594.json";

/**
 * The 71 Urban Duplex models. 66 are one row of cabinets and shelves, which the scene places as its
 * four UD products; the five Multi-Level ones hang at two wall heights and keep no flat composition.
 */

const presets = presetsSchema.parse(urbanDuplexPresetsDocument);

const parsedProfile = parseProductProfile(urbanDuplexProfileDocument);
const parsedBindings = parseRuntimeBindings(urbanDuplexBindingsDocument);
if (!parsedProfile.ok || !parsedBindings.ok) throw new Error("the packaged Urban Duplex data must parse");
const profile = parsedProfile.profile;
const bindings = parsedBindings.bindings;

const isMultiLevel = (title: string) => /multi-level/i.test(title);
const flatPresets = presets.filter(({ title }) => !isMultiLevel(title));

const numbersOf = (cell: string) => cell.split("|").map(Number);
/** Cabinet table 594: the sizes each cabinet type comes in. */
const SIZES = Object.fromEntries(
  cabinetTable594.rows.map((row) => [
    row.cabinet_type,
    {
      widths: numbersOf(row.widths_cm),
      heights: numbersOf(row.supports_height),
      depths: numbersOf(row.depths_cm),
    },
  ]),
);

/**
 * Models whose open side shelf stands at a height the scene does not lay out yet: its
 * RuleHeightUDOpenShelvesSide knows 56 and 53 cm, the price list also 38 and 28. The shelf of
 * these is drawn 56 cm high. The list only shrinks: it empties when the scene takes the low heights.
 */
const PENDING_SIDE_SHELF_HEIGHTS: Record<number, number> = { 16: 38, 60: 28 };

describe("urban-duplex model compositions", () => {
  it("gives every model but the Multi-Level ones a composition the scene places", () => {
    expect(presets).toHaveLength(71);
    expect(presets.filter(({ title }) => isMultiLevel(title)).map(({ id }) => id)).toEqual([29, 34, 44, 45, 64]);
    expect(flatPresets).toHaveLength(66);

    for (const { title, presetProducts } of presets) {
      if (isMultiLevel(title)) {
        expect(presetProducts, title).toEqual([]);
        continue;
      }

      expect(presetProducts.length, title).toBeGreaterThan(0);
      for (const { name } of presetProducts) {
        expect(selectOptionValues(profile, "CabinetType"), title).toContain(name);
        // Its scene product: without one the whole model is refused.
        expect(Object.keys(bindings.productTypes), title).toContain(name);
      }
    }
  });

  it("uses the shelf sizes of the cabinet table", () => {
    for (const { title, presetProducts } of flatPresets) {
      for (const { name, Width, Height, Depth } of presetProducts) {
        if (name !== "Open-Shelf" && name !== "Side-Shelf") continue;

        expect(SIZES[name].widths, title).toContain(Width);
        expect(SIZES[name].heights, title).toContain(Height);
        expect(SIZES[name].depths, title).toContain(Depth);
      }
    }
  });

  it("stands every drawer cabinet at a height the builder offers for its style, the Slim ones included", () => {
    const normalizeDrawers = (value: string) => normalizeOptionValue(profile, "Drawers", value) ?? value;
    const { relations } = normalizeHandleProfile({
      rows: cabinetTable594.rows,
      adapter: profile.ruleData.cabinetMatrixLegacyAdapter,
      normalizeDrawers,
    });
    /** The heights the rules leave a cabinet of this type and drawers: a choice, or the forced one. */
    const heightsOf = (cabinetType: string, drawers: string) => {
      const relation = relations.find((entry) => entry.cabinetType === cabinetType);
      return relation?.heightsByDrawers[drawers] ?? [relation?.forcedHeightByDrawers[drawers]];
    };

    const slim: number[] = [];
    for (const { id, title, presetProducts } of flatPresets) {
      for (const { name, Drawers, Height } of presetProducts) {
        if (Drawers === undefined) continue;

        expect(heightsOf(name, normalizeDrawers(Drawers)), title).toContain(Height);
        if ((Height === 38 || Height === 28) && !slim.includes(id)) slim.push(id);
      }
    }

    // The 25 Slim models of the Master File: Customize keeps their height, and the builder reaches it.
    expect(slim).toHaveLength(25);
    expect(heightsOf("Sink-Base", "1")).toEqual([53, 38, 28]);
    expect(heightsOf("Sink-Cabinet", "1")).toEqual([53, 38, 28]);
    expect(heightsOf("Sink-Base", "2")).toEqual([56]);
    expect(heightsOf("Sink-Base", "1+inner")).toEqual([53]);
  });

  it("stands an open side shelf at an end of the row, two at most, spelled with that end", () => {
    for (const { title, presetProducts } of flatPresets) {
      const sideShelves = presetProducts.flatMap((product, index) =>
        product.name === "Side-Shelf" ? [{ index, side: product.OpenSideShelfSide }] : [],
      );

      expect(sideShelves.length, title).toBeLessThanOrEqual(2);
      for (const { index, side } of sideShelves) {
        expect([0, presetProducts.length - 1], title).toContain(index);
        // The price reads the end from the shelf's place: the first product is L, any other R.
        expect(side, title).toBe(index === 0 ? "L" : "R");
      }
    }
  });

  it("lists the models whose open side shelf is lower than the scene lays one out", () => {
    // The scene's rule for the height of the open side shelf, as shipped.
    expect(sceneCode).toContain(".values({56:{y:0},53:{y:-0.03}})");

    const lowSideShelves = Object.fromEntries(
      flatPresets.flatMap(({ id, presetProducts }) =>
        presetProducts.flatMap(({ name, Height }) =>
          name === "Side-Shelf" && Height !== 56 && Height !== 53 ? [[id, Height]] : [],
        ),
      ),
    );

    expect(lowSideShelves).toEqual(PENDING_SIDE_SHELF_HEIGHTS);
  });
});
