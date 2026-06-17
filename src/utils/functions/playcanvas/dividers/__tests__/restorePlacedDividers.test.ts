import { describe, expect, it } from "vitest";

import { pickDividerConfigPatch } from "../restorePlacedDividers";

describe("restorePlacedDividers", () => {
  it("picks only divider config keys from a restored product config", () => {
    const topDrawerDividers = { zones: { left: { slots: [{ value: "A" }] } } };
    const botDrawerDividers = { zones: { right: { slots: [{ value: "B" }] } } };

    expect(
      pickDividerConfigPatch({
        Width: 120,
        CabinetColor: "Pulpis Chiaro TKH",
        TopDrawerDividers: topDrawerDividers,
        BotDrawerDividers: botDrawerDividers,
      }),
    ).toEqual({
      TopDrawerDividers: topDrawerDividers,
      BotDrawerDividers: botDrawerDividers,
    });
  });

  it("returns an empty patch when divider config is absent or malformed", () => {
    expect(pickDividerConfigPatch(null)).toEqual({});
    expect(pickDividerConfigPatch({ Width: 120 })).toEqual({});
  });
});
