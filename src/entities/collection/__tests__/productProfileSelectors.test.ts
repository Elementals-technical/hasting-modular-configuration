import { describe, expect, it } from "vitest";

import { selectMessage, selectRuleData } from "../lib/productProfileSelectors";
import type { ProductProfile } from "../model/productProfile";
import { ushProfile } from "./ushProfileFixture";

const withMessages = (messages: Record<string, string>): ProductProfile => ({ ...ushProfile, messages });

describe("selectMessage", () => {
  it("returns the text of a reason code", () => {
    expect(selectMessage(ushProfile, "fluting.requiresLacquerMatte")).toBe(
      "Fluting is available only for Lacquer Matte (LACM).",
    );
  });

  it("falls back to the code itself when the collection has no text", () => {
    expect(selectMessage(ushProfile, "unknown.reason")).toBe("unknown.reason");
    expect(selectMessage(null, "fluting.requiresLacquerMatte")).toBe("fluting.requiresLacquerMatte");
  });

  it("substitutes params into placeholders", () => {
    const profile = withMessages({ "sidePanel.exactLength": 'Not available at exactly {lengthCm} cm ({lengthIn}").' });

    expect(selectMessage(profile, "sidePanel.exactLength", { lengthCm: 340, lengthIn: "133.9" })).toBe(
      'Not available at exactly 340 cm (133.9").',
    );
  });

  it("leaves a placeholder without a param visible", () => {
    const profile = withMessages({ "grain.excluded": "Not available for {material}: {finishes}." });

    expect(selectMessage(profile, "grain.excluded", { material: "HPL" })).toBe("Not available for HPL: {finishes}.");
  });
});

describe("selectRuleData", () => {
  it("returns a declared rule section", () => {
    expect(selectRuleData(ushProfile, "syntesi")?.maxCabinetCount).toBe(1);
  });

  it("returns undefined for an undeclared section or without a profile", () => {
    expect(selectRuleData(ushProfile, "vesselCompatibility")).toBeUndefined();
    expect(selectRuleData(null, "fluting")).toBeUndefined();
  });
});
