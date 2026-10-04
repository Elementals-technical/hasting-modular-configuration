import { describe, expect, it } from "vitest";

import { ushProfile as profile } from "@/entities/collection/__tests__/ushProfileFixture";

import { selectOptionLabel } from "../lib/selectOptionLabel";

describe("selectOptionLabel", () => {
  it("returns the profile label of a canonical value", () => {
    expect(selectOptionLabel(profile, "Handle", "handle_pto")).toBe("Push to open");
    expect(selectOptionLabel(profile, "SidePanels", "UpperG")).toBe("1 groove (upper)");
  });

  it("resolves the legacy spelling the state stores through the option aliases", () => {
    expect(selectOptionLabel(profile, "Drawers", "1D")).toBe("1 Drawer");
    expect(selectOptionLabel(profile, "Drawers", "1DWID")).toBe("1 Drawer With Inner Drawer");
  });

  it("falls back to the value itself when the profile does not know it", () => {
    expect(selectOptionLabel(profile, "Handle", "handle_unknown")).toBe("handle_unknown");
    expect(selectOptionLabel(null, "Handle", "handle_pto")).toBe("handle_pto");
    expect(selectOptionLabel(profile, "Handle", null)).toBe("");
  });
});
