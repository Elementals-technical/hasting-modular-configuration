import { describe, expect, it } from "vitest";

import makoPresetsDocument from "../../../../../public/collections/mako/presets.json";
import { presetsSchema } from "@/entities/collection";

import { resolveActivePrebuiltPresetId } from "../resolveActivePrebuiltPresetId";

const ONE_DRAWER = { id: 1, presetProducts: [{ name: "Sink-Base", Width: 60, Drawers: "1D" }] };
const TWO_DRAWER = { id: 2, presetProducts: [{ name: "Sink-Base", Width: 60, Drawers: "2D" }] };
// A compact model has rows instead of products.
const COMPACT = { id: 3, presetProducts: [] };
const PRESETS = [COMPACT, ONE_DRAWER, TWO_DRAWER];

const sources = {
  presets: PRESETS,
  presetIdFromUrl: null,
  hasConfigIdInUrl: false,
  productsPresets: [],
  placedProductIds: [],
  defaultPresetId: ONE_DRAWER.id,
};

describe("resolveActivePrebuiltPresetId", () => {
  it("takes the preset the URL names, over the one equal to the state", () => {
    expect(
      resolveActivePrebuiltPresetId({
        ...sources,
        presetIdFromUrl: TWO_DRAWER.id,
        productsPresets: ONE_DRAWER.presetProducts,
      }),
    ).toBe(TWO_DRAWER.id);
  });

  it("takes the preset the URL names while the state is empty and the scene holds the model", () => {
    expect(
      resolveActivePrebuiltPresetId({ ...sources, presetIdFromUrl: TWO_DRAWER.id, placedProductIds: ["a", "b"] }),
    ).toBe(TWO_DRAWER.id);
  });

  it("takes a compact preset the URL names, which no state can equal", () => {
    expect(
      resolveActivePrebuiltPresetId({
        ...sources,
        presetIdFromUrl: COMPACT.id,
        productsPresets: ONE_DRAWER.presetProducts,
      }),
    ).toBe(COMPACT.id);
  });

  it("leaves the URL's preset to a saved configuration, which is told by the state", () => {
    expect(
      resolveActivePrebuiltPresetId({
        ...sources,
        presetIdFromUrl: TWO_DRAWER.id,
        hasConfigIdInUrl: true,
        productsPresets: ONE_DRAWER.presetProducts,
      }),
    ).toBe(ONE_DRAWER.id);
  });

  it("takes the preset equal to the state when the URL names none", () => {
    expect(
      resolveActivePrebuiltPresetId({
        ...sources,
        productsPresets: TWO_DRAWER.presetProducts,
        placedProductIds: ["a"],
      }),
    ).toBe(TWO_DRAWER.id);
  });

  it("highlights nothing for a composition no preset equals", () => {
    const placed = [{ name: "Sink-Base", Width: 40, Drawers: "1D" }];

    expect(resolveActivePrebuiltPresetId({ ...sources, productsPresets: placed, placedProductIds: ["a"] })).toBeNull();
    expect(resolveActivePrebuiltPresetId({ ...sources, productsPresets: placed })).toBeNull();
    expect(
      resolveActivePrebuiltPresetId({
        ...sources,
        hasConfigIdInUrl: true,
        productsPresets: placed,
        placedProductIds: ["a"],
      }),
    ).toBeNull();
  });

  it("highlights nothing for placed cabinets the state holds no products of", () => {
    expect(resolveActivePrebuiltPresetId({ ...sources, placedProductIds: ["a", "b"] })).toBeNull();
  });

  it("takes the default preset only while nothing is placed", () => {
    expect(resolveActivePrebuiltPresetId(sources)).toBe(ONE_DRAWER.id);
    expect(resolveActivePrebuiltPresetId({ ...sources, defaultPresetId: null })).toBeNull();
  });

  it("does not read an empty state as a compact preset", () => {
    expect(resolveActivePrebuiltPresetId({ ...sources, defaultPresetId: TWO_DRAWER.id })).toBe(TWO_DRAWER.id);
  });

  it("finds a shipped Mako model without legs after selecting it recorded none", () => {
    const presets = presetsSchema.parse(makoPresetsDocument);
    const twoDrawer = presets.find(({ id }) => id === 3);
    if (!twoDrawer) throw new Error("the Mako catalog must hold model 3");

    expect(
      resolveActivePrebuiltPresetId({
        ...sources,
        presets,
        defaultPresetId: presets[0].id,
        productsPresets: twoDrawer.presetProducts.map((product) => ({ ...product, LegColor: "" })),
        placedProductIds: ["Mako-sink-cabinet-aaa111"],
      }),
    ).toBe(3);
  });
});
