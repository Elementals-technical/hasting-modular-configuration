import { describe, expect, it } from "vitest";

import { COUNTERTOP_THICKNESS_OPTIONS } from "@/entities/countertop";

import { ushProfile } from "./ushProfileFixture";
import { selectOptions } from "../lib/productProfileSelectors";

/** DEV-06 handoff: the shared thickness catalogue must still equal the profile's until it reads the profile. */

type PageOption = { title?: string; name?: string; value?: string; metadata?: { value?: string } };

const pairsOf = (options: readonly PageOption[], valueKey: "name" | "value") =>
  options.map((option) => [option[valueKey], option.title]);

const profilePairs = (attributeId: string) =>
  selectOptions(ushProfile, attributeId).map(({ value, label }) => [value, label]);

describe("countertop thicknesses", () => {
  it("are the Thickness options of the profile", () => {
    expect(pairsOf(COUNTERTOP_THICKNESS_OPTIONS as PageOption[], "value")).toEqual(profilePairs("Thickness"));
  });
});
