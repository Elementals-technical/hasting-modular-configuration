import { describe, expect, it } from "vitest";

import { resolveTowelBarOption } from "../lib/resolveTowelBarOption";

describe("resolveTowelBarOption", () => {
  it.each(["None", "Left", "Right", "Both"])("keeps the option %s, whatever the side says", (option) => {
    expect(resolveTowelBarOption(option, "left")).toBe(option);
  });

  it.each([
    ["left", "Left"],
    ["RIGHT", "Right"],
    ["both", "Both"],
  ])("reads a legacy scene towel bar from its side %s", (side, option) => {
    expect(resolveTowelBarOption("TowelBar40_R", side)).toBe(option);
  });

  it.each([
    ["no option", undefined, "left"],
    ["an empty option", "", "left"],
    ["a legacy towel bar without a side", "TowelBar40_R", undefined],
    ["a legacy towel bar with an unknown side", "TowelBar40_R", "top"],
  ])("gives no option for %s", (_, option, side) => {
    expect(resolveTowelBarOption(option, side)).toBeUndefined();
  });
});
