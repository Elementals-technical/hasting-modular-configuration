import { describe, expect, it } from "vitest";

import { ushProfile } from "./ushProfileFixture";
import { selectMessage, selectMessageOr } from "../lib/productProfileSelectors";

/**
 * DEV-08: a page passes a reason code and the English text it used to hardcode. The
 * collection's own wording wins; a collection that declares none reads exactly as before,
 * never as the bare code.
 */

describe("selectMessageOr", () => {
  it("returns the collection's text for a declared code", () => {
    expect(selectMessageOr(ushProfile, "countertop.materialNotAvailableForDepth", "fallback")).toBe(
      "Not available for current cabinet depth",
    );
  });

  it("returns the fallback for a code the collection does not declare", () => {
    expect(selectMessageOr(ushProfile, "countertop.thisCodeDoesNotExist", "Not available")).toBe("Not available");
    expect(selectMessageOr(null, "countertop.materialNotAvailableForDepth", "Not available")).toBe("Not available");
  });

  it("fills placeholders of the collection's text", () => {
    expect(selectMessageOr(ushProfile, "unknown.code", "{amount} cm max", { amount: 220 })).toBe("{amount} cm max");
    expect(selectMessage(ushProfile, "countertop.materialNotAvailableForSize")).toBe(
      "Not available for current cabinet size on scene",
    );
  });

  it("gives the countertop step every reason the pages used to hardcode", () => {
    const codes = [
      "countertop.materialNotAvailableForSize",
      "countertop.materialNotAvailableForTotalWidth",
      "countertop.materialNotAvailableForDepth",
      "countertop.materialNotAvailableForWidth",
      "countertop.materialNotAvailableForSelection",
    ];

    expect(codes.filter((code) => selectMessage(ushProfile, code) === code)).toEqual([]);
  });
});
