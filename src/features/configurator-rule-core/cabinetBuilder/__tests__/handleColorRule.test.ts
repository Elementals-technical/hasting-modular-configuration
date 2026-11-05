import { describe, expect, it } from "vitest";

import lameProfileDocument from "../../../../../public/collections/lame/product-profile.json";
import { parseProductProfile } from "@/entities/collection";
import { makoProfile } from "@/entities/collection/__tests__/makoProfileFixture";

import { resolveHandleColor, selectHandleColors } from "../lib/handleColorRule";

const parsedLame = parseProductProfile(lameProfileDocument);
if (!parsedLame.ok) throw new Error("Lame profile must parse");
const lameProfile = parsedLame.profile;

describe("the colour a handle holds", () => {
  it.each([
    ["moves a G50 off a lacquered colour to the one it starts in", makoProfile, "G50", "Nebbia 402 MT", "Silver"],
    ["keeps a colour a G50 comes in", makoProfile, "G50", "Gold", "Gold"],
    ["starts a G50 with no colour yet in its first", makoProfile, "G50", "", "Silver"],
    [
      "keeps a lacquered colour on a G57, which the map does not name",
      makoProfile,
      "G57",
      "Nebbia 402 MT",
      "Nebbia 402 MT",
    ],
    ["leaves a G57 with no colour yet without one", makoProfile, "G57", "", ""],
    ["keeps the colour in a profile with no section", lameProfile, "G58", "Nebbia 402 MT", "Nebbia 402 MT"],
  ])("%s", (_name, profile, handle, current, expected) => {
    expect(resolveHandleColor(profile, handle, current)).toBe(expected);
  });
});

describe("the colours a handle comes in", () => {
  it("lists them for a handle the map names, Silver first for a G50", () => {
    expect(selectHandleColors(makoProfile, "G50")).toEqual(["Silver", "Gold"]);
  });

  it.each([
    ["a handle the map does not name", makoProfile, "G57"],
    ["no handle", makoProfile, null],
    ["a profile with no section", lameProfile, "G58"],
    ["no profile", null, "G50"],
  ])("leaves the field's colours as they are for %s", (_name, profile, handle) => {
    expect(selectHandleColors(profile, handle)).toBe(undefined);
  });
});
