import { describe, expect, it } from "vitest";

import { clearEditSizeButton, LENGTH_CHIP_SIZE_PX } from "../lib/editSizeButtonClearance";

/** The 40 px button of the reproduction (iframe px): 365,210 to 405,250; with the 4 px gap 361,206 to 409,254. */
const BUTTON = { left: 365, top: 210, right: 405, bottom: 250 };
/** The length chip's and the move marker's centres there (chip 382,220 58×20; marker 371,232 29×29). */
const CHIP = { x: 411, y: 230 };
const MARKER = { x: 385.5, y: 246.5 };
const CHIP_HALF_HEIGHT = LENGTH_CHIP_SIZE_PX.height / 2;

describe("Edit size button clearance", () => {
  it("leaves the chip and the marker where they are without a button", () => {
    expect(clearEditSizeButton(null, { chip: CHIP, marker: MARKER })).toEqual({ chip: CHIP, marker: MARKER });
  });

  it("moves the chip right above the button and the marker right below it, x unchanged", () => {
    expect(clearEditSizeButton(BUTTON, { chip: CHIP, marker: MARKER })).toEqual({
      chip: { x: 411, y: 206 - CHIP_HALF_HEIGHT },
      marker: { x: 385.5, y: 254 + 15 },
    });
  });

  it("moves only the chip when the marker is clear of the button", () => {
    const marker = { x: 385.5, y: 300 };
    expect(clearEditSizeButton(BUTTON, { chip: CHIP, marker })).toEqual({
      chip: { x: 411, y: 206 - CHIP_HALF_HEIGHT },
      marker,
    });
  });

  it("moves only the marker when the chip is clear of the button", () => {
    const chip = { x: 385, y: 150 };
    expect(clearEditSizeButton(BUTTON, { chip, marker: MARKER })).toEqual({ chip, marker: { x: 385.5, y: 269 } });
  });

  it("keeps the gap: a chip within 4 px of the button moves, one just outside it stays", () => {
    const touching = { x: 385, y: 206 - CHIP_HALF_HEIGHT + 1 };
    const clear = { x: 385, y: 206 - CHIP_HALF_HEIGHT };
    expect(clearEditSizeButton(BUTTON, { chip: touching, marker: null }).chip).toEqual(clear);
    expect(clearEditSizeButton(BUTTON, { chip: clear, marker: null }).chip).toBe(clear);
  });

  it("leaves a chip right of the button alone once its box is past the gap", () => {
    const chip = { x: 409 + LENGTH_CHIP_SIZE_PX.width / 2, y: 230 };
    expect(clearEditSizeButton(BUTTON, { chip, marker: null }).chip).toBe(chip);
  });

  it("draws nothing it was not given", () => {
    expect(clearEditSizeButton(BUTTON, { chip: null, marker: null })).toEqual({ chip: null, marker: null });
  });
});
