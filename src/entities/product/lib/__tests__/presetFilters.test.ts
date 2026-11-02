import { describe, expect, it } from "vitest";

import { presetsSchema, type CollectionPreset } from "@/entities/collection/model/schemas";

import { buildPresetFilterOptions, matchesPresetFilters, type PresetFilters } from "../presetFilters";

/** The model filters of every packaged collection, built from its own presets. */

const presetsByCollection = new Map<string, CollectionPreset[]>(
  Object.entries(import.meta.glob("/public/collections/*/presets.json", { eager: true, import: "default" })).map(
    ([path, document]) => [path.split("/").at(-2) ?? path, presetsSchema.parse(document)],
  ),
);

const presetsOf = (collectionId: string) => presetsByCollection.get(collectionId) ?? [];

const NO_FILTERS: PresetFilters = { size: "all", style: "all" };

const valuesOf = (options: ReadonlyArray<{ value: string }>) =>
  options.map(({ value }) => value).filter((value) => value !== "all");

const disabledValuesOf = (options: ReadonlyArray<{ value: string; disabled?: boolean }>) =>
  options.filter(({ disabled }) => disabled).map(({ value }) => value);

describe("the model filters of a collection", () => {
  it("are built for all eight packaged collections", () => {
    expect([...presetsByCollection.keys()].sort()).toEqual([
      "class",
      "lame",
      "mako",
      "tricot",
      "urban-duplex",
      "urban-freestanding",
      "urban-low-height",
      "urban-standard-height",
    ]);
  });

  it("leave out of Tricot the 90″+ size, open shelving and multi-level (T-3)", () => {
    const { size, style } = buildPresetFilterOptions(presetsOf("tricot"), NO_FILTERS);

    expect(valuesOf(size)).toEqual(["24_29", "30_39", "40_49", "50_59", "60_69", "70_79", "80_89"]);
    expect(valuesOf(style)).toEqual(["1_drawer", "2_drawer", "single_basin", "double_basin", "asymmetrical"]);
  });

  it("leave out of Class the 90″+ size, two drawers, open shelving and multi-level (C-15)", () => {
    const { size, style } = buildPresetFilterOptions(presetsOf("class"), NO_FILTERS);

    expect(valuesOf(size)).toEqual(["24_29", "30_39", "40_49", "50_59", "60_69", "70_79", "80_89"]);
    expect(valuesOf(style)).toEqual(["1_drawer", "single_basin", "double_basin", "asymmetrical"]);
  });

  it("leave out of Urban Low Height two drawers only (ULH-4)", () => {
    const { size, style } = buildPresetFilterOptions(presetsOf("urban-low-height"), NO_FILTERS);

    expect(size).toHaveLength(9);
    expect(valuesOf(style)).toEqual([
      "1_drawer",
      "single_basin",
      "double_basin",
      "asymmetrical",
      "open_shelving",
      "multi_level",
    ]);
  });

  it("keep every value in Urban Duplex, whose models have them all", () => {
    const { size, style } = buildPresetFilterOptions(presetsOf("urban-duplex"), NO_FILTERS);

    expect(size).toHaveLength(9);
    expect(style).toHaveLength(8);
  });

  it("disable what does not go with the other filter's value in Tricot, both ways", () => {
    const presets = presetsOf("tricot");

    const withSize = buildPresetFilterOptions(presets, { size: "24_29", style: "all" });
    expect(disabledValuesOf(withSize.style)).toEqual(["2_drawer", "double_basin", "asymmetrical"]);
    expect(disabledValuesOf(withSize.size)).toEqual([]);

    const withStyle = buildPresetFilterOptions(presets, { size: "all", style: "double_basin" });
    expect(disabledValuesOf(withStyle.size)).toEqual(expect.arrayContaining(["24_29", "30_39", "50_59"]));
    expect(disabledValuesOf(withStyle.style)).toEqual([]);
  });
});

describe.each([...presetsByCollection])("the model filters of %s", (_, presets) => {
  const { size: sizes, style: styles } = buildPresetFilterOptions(presets, NO_FILTERS);

  it("offer every value its models have", () => {
    expect(valuesOf(sizes)).toEqual(expect.arrayContaining([...new Set(presets.map(({ size }) => size))]));
    expect(valuesOf(styles)).toEqual(expect.arrayContaining([...new Set(presets.flatMap(({ style }) => style))]));
  });

  it("disable nothing while no filter is chosen", () => {
    expect(disabledValuesOf(sizes)).toEqual([]);
    expect(disabledValuesOf(styles)).toEqual([]);
  });

  it("disable a value exactly when it leaves no model with the other filter's value, so no choice ends empty", () => {
    const collectionSizes = [...new Set(presets.map(({ size }) => size))];
    const collectionStyles = [...new Set(presets.flatMap(({ style }) => style))];

    for (const size of collectionSizes) {
      for (const style of collectionStyles) {
        const isEmpty = !presets.some((preset) => matchesPresetFilters(preset, { size, style }));

        expect(disabledValuesOf(buildPresetFilterOptions(presets, { size, style: "all" }).style).includes(style)).toBe(
          isEmpty,
        );
        expect(disabledValuesOf(buildPresetFilterOptions(presets, { size: "all", style }).size).includes(size)).toBe(
          isEmpty,
        );
      }
    }
  });

  it("never disable All", () => {
    const { size, style } = buildPresetFilterOptions(presets, { size: presets[0].size, style: presets[0].style[0] });

    expect(size[0]).toEqual({ label: "All", value: "all" });
    expect(style[0]).toEqual({ label: "All", value: "all" });
  });
});
