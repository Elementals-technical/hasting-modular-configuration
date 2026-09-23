import { describe, expect, it } from "vitest";

import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";
import { ushCustomizationSchema } from "@/entities/collection/__tests__/ushUiFixture";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { selectBasinOptions, selectOptions } from "@/entities/collection";

import {
  buildBasinOptions,
  buildCountertopStyleOptions,
  buildDividerModeOptions,
  buildDividerStyleOptions,
  buildSidePanelOptions,
  buildThicknessOptions,
  buildTowelBarOptions,
} from "../lib/pageOptionCatalogs";

/**
 * B06: the countertop and accessories steps list their options from the active collection's
 * profile. The lists keep the shape the pages used when they were constants; the pictures come
 * from the collection's ui.json and are joined by option value.
 */

const ushOptionImages = ushCustomizationSchema.optionImages;

describe("page option lists from the USH profile", () => {
  it("list every basin in profile order, integrated first, each with its picture", () => {
    const basins = buildBasinOptions(ushProfile, ushOptionImages);
    const expected = [...selectBasinOptions(ushProfile, "integrated"), ...selectBasinOptions(ushProfile, "vessel")];

    expect(basins.map(({ name, title }) => [name, title])).toEqual(expected.map(({ value, label }) => [value, label]));
    expect(basins).toHaveLength(36);
    expect(basins.filter(({ metadata }) => !("image" in metadata)).map(({ name }) => name)).toEqual([]);
    expect(basins.filter(({ isShortDesc }) => isShortDesc).map(({ name }) => name)).toEqual(["Top_HPLPrisma"]);
  });

  it("list the countertop styles with pictures and the thicknesses with their stored values", () => {
    expect(
      buildCountertopStyleOptions(ushProfile, ushOptionImages).map(({ title, metadata }) => [
        title,
        "image" in metadata,
      ]),
    ).toEqual([
      ["Integrated", true],
      ["Vessel", true],
    ]);
    expect(buildThicknessOptions(ushProfile).map(({ value }) => value)).toEqual(
      selectOptions(ushProfile, "Thickness").map(({ value }) => value),
    );
  });

  it("list the accessories, pictures on every side panel but None and on every divider style", () => {
    const sidePanels = buildSidePanelOptions(ushProfile);

    expect(sidePanels.map(({ metadata }) => metadata.value)).toEqual(["None", "NoG", "UpperG", "CenterG", "DoubleG"]);
    expect(sidePanels.filter(({ metadata }) => !("image" in metadata)).map(({ title }) => title)).toEqual(["None"]);
    expect(buildDividerStyleOptions(ushProfile).map(({ title, metadata }) => [title, "image" in metadata])).toEqual([
      ["Option A", true],
      ["Option B", true],
      ["Option C", true],
    ]);
    expect(buildDividerModeOptions(ushProfile).map(({ title }) => title)).toEqual(["None", "Customize"]);
    expect(buildTowelBarOptions(ushProfile).map(({ title }) => title)).toEqual(["None", "Left", "Right", "Both"]);
  });
});

describe("page option lists of another collection", () => {
  it("come from that collection's profile, never USH's", () => {
    expect(buildBasinOptions(makoProfile).map(({ name }) => name)).toEqual(
      [...selectBasinOptions(makoProfile, "integrated"), ...selectBasinOptions(makoProfile, "vessel")].map(
        ({ value }) => value,
      ),
    );
    expect(buildDividerStyleOptions(makoProfile).map(({ title }) => title)).toEqual(["Metal", "Oak"]);
    // Mako declares no side panels, thickness or towel bar: the lists are empty, not USH's.
    expect(buildSidePanelOptions(makoProfile)).toEqual([]);
    expect(buildThicknessOptions(makoProfile)).toEqual([]);
    expect(buildTowelBarOptions(makoProfile)).toEqual([]);
  });

  it("are empty without a profile", () => {
    expect(buildBasinOptions(null)).toEqual([]);
    expect(buildCountertopStyleOptions(null)).toEqual([]);
  });

  it("keep an option the collection declares no picture for, without a picture", () => {
    const basins = buildBasinOptions(makoProfile, ushOptionImages);

    expect(basins.length).toBeGreaterThan(0);
    expect(basins.every(({ metadata }) => !("image" in metadata))).toBe(true);
  });

  it("show no picture at all when the collection declares none", () => {
    expect(buildBasinOptions(ushProfile).every(({ metadata }) => !("image" in metadata))).toBe(true);
  });
});
