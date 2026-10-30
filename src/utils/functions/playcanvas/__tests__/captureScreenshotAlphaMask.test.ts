import { describe, expect, it } from "vitest";

import { isAlphaProductMask } from "../captureScreenshot";

describe("isAlphaProductMask", () => {
  it("trusts the alpha when the build reports what it left out", () => {
    expect(isAlphaProductMask({ bg: null, includeRoom: false }, { hiddenEntities: ["Room1_Point"] })).toBe(true);
    // A build that supports hiding but has no room in the scene.
    expect(isAlphaProductMask({ bg: null, includeRoom: false }, { hiddenEntities: [] })).toBe(true);
  });

  it("keeps clearing the background by colour for builds before room hiding", () => {
    expect(isAlphaProductMask({ bg: null, includeRoom: false }, {})).toBe(false);
  });

  it("needs both a transparent background and the room out of the frame", () => {
    expect(isAlphaProductMask({ bg: "#ffffff", includeRoom: false }, { hiddenEntities: [] })).toBe(false);
    expect(isAlphaProductMask({ bg: null }, { hiddenEntities: [] })).toBe(false);
  });
});
