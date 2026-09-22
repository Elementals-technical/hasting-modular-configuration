import { describe, expect, it } from "vitest";

import { interpolateMessage } from "../interpolate";
import { resolveUiReasonText } from "../reasonTextContext";
import { UI_REASON_TEXTS } from "../uiReasonTexts";

/**
 * DEV-08: one place turns a reason code into the text the user reads. Without a collection
 * mounted only the interface dictionary is known, which is what a component shows on its own.
 */

describe("the interface resolver", () => {
  it("reads the dictionary for a code it knows", () => {
    expect(resolveUiReasonText({ code: "ui.optionUnavailable" })).toBe("Not available for selected configuration");
    expect(resolveUiReasonText({ code: "drawers.mixingRestricted" })).toBe(
      UI_REASON_TEXTS["drawers.mixingRestricted"],
    );
  });

  it("prefers the dictionary over a text the caller resolved itself", () => {
    expect(resolveUiReasonText({ code: "ui.valueUnavailable", text: "stale text" })).toBe("Not available.");
  });

  it("falls back to the caller's text, then to the code, for a code it does not know", () => {
    expect(resolveUiReasonText({ code: "countertop.maxCompatibleWidth", text: "Too wide" })).toBe("Too wide");
    expect(resolveUiReasonText({ code: "countertop.maxCompatibleWidth" })).toBe("countertop.maxCompatibleWidth");
    expect(resolveUiReasonText({})).toBeUndefined();
  });
});

describe("placeholders", () => {
  it("are filled from the params, and left as written when a value is missing", () => {
    expect(interpolateMessage('Max {maxCm} cm ({maxIn}")', { maxCm: 160, maxIn: 63 })).toBe('Max 160 cm (63")');
    expect(interpolateMessage("Max {maxCm} cm", {})).toBe("Max {maxCm} cm");
    expect(interpolateMessage("No placeholders")).toBe("No placeholders");
  });
});
