import { describe, expect, it } from "vitest";

import { deriveDividerOptions } from "../deriveOptions";
import type { DividerAvailability } from "../types";

const mockOptions = [
  { id: 5000, title: "Option A", isShortDesc: false },
  { id: 5001, title: "Option B", isShortDesc: false },
  { id: 5002, title: "Option C", isShortDesc: false },
];

describe("deriveDividerOptions", () => {
  it("returns the options untouched when availability is unknown", () => {
    expect(deriveDividerOptions(mockOptions, null)).toEqual(mockOptions);
    expect(deriveDividerOptions(mockOptions, undefined)).toEqual(mockOptions);
  });

  it("marks unavailable options with the exact legacy warning text", () => {
    const result = deriveDividerOptions(mockOptions, ["A", "B"]);

    expect(result[0]).toMatchObject({ title: "Option A", isAvailable: true, disabledReason: undefined });
    expect(result[1]).toMatchObject({ title: "Option B", isAvailable: true, disabledReason: undefined });
    expect(result[2]).toMatchObject({
      title: "Option C",
      isAvailable: false,
      disabledReason: "Option C does not fit here. Choose one of: Option A, Option B.",
    });
  });

  it("accepts a Set (legacy page-level availability state)", () => {
    const result = deriveDividerOptions(mockOptions, new Set(["C"] as const));

    expect(result.map((option) => option.isAvailable)).toEqual([false, false, true]);
  });

  it("accepts a DividerAvailability record", () => {
    const availability: DividerAvailability = {
      context: { cabinetId: "cab", drawerType: "Bot" },
      types: ["B"],
      fetchedAt: 123,
    };

    const result = deriveDividerOptions(mockOptions, availability);

    expect(result.map((option) => option.isAvailable)).toEqual([false, true, false]);
  });

  it("uses the empty-availability wording when nothing fits", () => {
    const result = deriveDividerOptions(mockOptions, []);

    expect(result[0].disabledReason).toBe(
      "Option A does not fit here. No Divider option is available for this slot.",
    );
  });

  it("keeps non-divider options available", () => {
    const result = deriveDividerOptions([{ title: "Something else" }], ["A"]);

    expect(result[0]).toMatchObject({ isAvailable: true, disabledReason: undefined });
  });
});
