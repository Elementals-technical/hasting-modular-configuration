import { describe, expect, it } from "vitest";

import { placeDimensionPopover } from "../dimensionPopoverPlacement";

describe("placeDimensionPopover", () => {
  const popover = { width: 368, height: 150 };
  // The desktop canvas left of the sidebar, down the whole window.
  const canvas = { left: 0, top: 0, right: 830, bottom: 950 };

  it("puts it above the chip, opening to its right, the tail over the chip", () => {
    expect(placeDimensionPopover({ x: 300, y: 350 }, popover, canvas)).toEqual({
      side: "above",
      left: 252,
      top: 350 - 10 - 18 - 150,
      tailLeft: 48,
    });
  });

  it("keeps it across the canvas at its edges, the tail still over the chip", () => {
    expect(placeDimensionPopover({ x: 609, y: 350 }, popover, canvas)).toMatchObject({
      left: 830 - 368 - 8,
      tailLeft: 609 - (830 - 368 - 8),
    });
    expect(placeDimensionPopover({ x: 20, y: 350 }, popover, canvas)).toMatchObject({ left: 8, tailLeft: 16 });
  });

  it("puts it below the chip when there is no room above", () => {
    expect(placeDimensionPopover({ x: 300, y: 60 }, popover, canvas)).toMatchObject({ side: "below", top: 60 + 10 + 18 });
  });

  it("puts it over the chip, inside the bounds, when there is room for neither", () => {
    // Above: 176 − 10 − 18 − 150 = −2 < 8; below: 176 + 10 + 18 + 150 = 354 > 353 − 8.
    expect(
      placeDimensionPopover({ x: 250, y: 176 }, popover, { left: 0, top: 0, right: 390, bottom: 353 }),
    ).toMatchObject({ side: "over", top: 8, left: 390 - 368 - 8 });
  });
});
