import { describe, expect, it } from "vitest";

import { COUNTERTOP_THICKNESS_OPTIONS } from "@/entities/countertop";
import * as prebuiltCountertop from "@/pages/prebuilt/countertop/constants";
import * as customCountertop from "@/pages/custom/countertop/constants";
import * as prebuiltAccessories from "@/pages/prebuilt/accessories/constants";
import * as customAccessories from "@/pages/custom/accessories/constants";

import { ushProfile } from "./ushProfileFixture";
import { selectBasinOptions, selectOptions } from "../lib/productProfileSelectors";

/**
 * DEV-06/07 handoff to B06: the pages still list basins, thicknesses and accessories from their
 * own constants. The USH profile already declares the same catalogs, so a page can switch to
 * `selectOptions` / `selectBasinOptions` without losing an option or changing a label. Only the
 * pictures stay on the page, as a map from option value to image.
 *
 * When a page moves to the profile, its constant and its case here go away (DEV-10).
 */

type PageOption = { title?: string; name?: string; value?: string; metadata?: { value?: string } };

const labelsOf = (options: readonly PageOption[]) => options.map(({ title }) => title);
const pairsOf = (options: readonly PageOption[], valueKey: "name" | "value") =>
  options.map((option) => [option[valueKey], option.title]);

const profilePairs = (attributeId: string) =>
  selectOptions(ushProfile, attributeId).map(({ value, label }) => [value, label]);

describe.each([
  ["prebuilt", prebuiltCountertop],
  ["custom", customCountertop],
])("%s countertop page constants", (_flow, constants) => {
  it("list every basin of the profile, with its value and label, in the same order", () => {
    const basins = [...selectBasinOptions(ushProfile, "integrated"), ...selectBasinOptions(ushProfile, "vessel")];

    expect(pairsOf(constants.optionsMockData3 as PageOption[], "name")).toEqual(
      basins.map(({ value, label }) => [value, label]),
    );
  });

  it("list the countertop styles of the profile", () => {
    expect(labelsOf(constants.optionsMockData2 as PageOption[])).toEqual(
      selectOptions(ushProfile, "CountertopStyle").map(({ label }) => label),
    );
  });
});

describe("countertop thicknesses", () => {
  it("are the Thickness options of the profile", () => {
    expect(pairsOf(COUNTERTOP_THICKNESS_OPTIONS as PageOption[], "value")).toEqual(profilePairs("Thickness"));
  });
});

describe.each([
  ["prebuilt", prebuiltAccessories],
  ["custom", customAccessories],
])("%s accessories page constants", (_flow, constants) => {
  it("list the side panels of the profile", () => {
    // The side panel value lives in the option's metadata.
    expect(
      (constants.optionsSidePanelsData as PageOption[]).map((option) => [option.metadata?.value, option.title]),
    ).toEqual(profilePairs("SidePanels"));
  });

  it("list the divider options of the profile", () => {
    expect(labelsOf(constants.optionsSwatchData2 as PageOption[])).toEqual(
      selectOptions(ushProfile, "DividersOption").map(({ label }) => label),
    );
  });

  it("list the divider styles of the profile", () => {
    expect(labelsOf(constants.dividersMockData as PageOption[])).toEqual(
      selectOptions(ushProfile, "DividersStyle").map(({ label }) => label),
    );
  });

  it("list the towel bar options of the profile", () => {
    expect(labelsOf(constants.optionsSwatchDataTowel as PageOption[])).toEqual(
      selectOptions(ushProfile, "TowelBarOption").map(({ label }) => label),
    );
  });
});
