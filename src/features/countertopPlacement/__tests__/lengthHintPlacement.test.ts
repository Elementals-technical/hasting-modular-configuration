import { describe, expect, it } from "vitest";

import type { CountertopOverlayFrame } from "@/features/configuratorApi";

import {
  actionRowBox,
  actionRowPositions,
  countertopScreenBox,
  LENGTH_HINT_SIZE_PX,
  placeLengthHint,
} from "../lib/lengthHintPlacement";

const frameOf = (overrides: Partial<CountertopOverlayFrame> = {}): CountertopOverlayFrame => ({
  active: true,
  status: "clear",
  reasons: [],
  collidesWith: [],
  attached: false,
  lengthM: 2,
  depthM: 0.5,
  limits: null,
  canApply: true,
  dragging: false,
  visible: true,
  viewport: { width: 1000, height: 800 },
  hull: [],
  bounds: null,
  points: null,
  lengthAxisPx: null,
  ...overrides,
});

const VIEWPORT = { width: 1000, height: 800 };
const TOP = { left: 300, top: 380, right: 700, bottom: 420 };
/** Apply / × under a bottom-right corner at (600, 425): x 537–625, y 428–452. */
const ROW_ANCHOR = { x: 600, y: 425 };

describe("countertop screen box", () => {
  it("takes the published bounds first", () => {
    const bounds = { left: 1, top: 2, right: 3, bottom: 4, width: 2, height: 2 };
    expect(countertopScreenBox(frameOf({ bounds, hull: [{ x: 50, y: 50 }] }))).toEqual(bounds);
  });

  it("falls back to the hull's box, then to the anchor points' box", () => {
    const hull = [
      { x: 10, y: 20 },
      { x: 30, y: 5 },
      { x: 25, y: 40 },
    ];
    expect(countertopScreenBox(frameOf({ hull }))).toEqual({ left: 10, top: 5, right: 30, bottom: 40 });
    const points = { center: { x: 5, y: 6 }, bottomRight: { x: 9, y: 12 } };
    expect(countertopScreenBox(frameOf({ points }))).toEqual({ left: 5, top: 6, right: 9, bottom: 12 });
  });

  it("has no box without bounds, hull or points", () => {
    expect(countertopScreenBox(frameOf({ points: {} }))).toBeNull();
  });
});

describe("action row box", () => {
  it("draws Apply, × and the reason at the anchor's offsets", () => {
    expect(actionRowPositions(ROW_ANCHOR)).toEqual({
      apply: { x: 597, y: 430 },
      discard: { x: 603, y: 428 },
      reason: { x: 625, y: 459 },
    });
  });

  it("covers Apply and ×, and the reason text under them when it is shown", () => {
    expect(actionRowBox(ROW_ANCHOR, null)).toEqual({ left: 537, top: 428, right: 625, bottom: 452 });
    expect(actionRowBox(ROW_ANCHOR, { width: 200, height: 40 })).toEqual({
      left: 425,
      top: 428,
      right: 625,
      bottom: 499,
    });
  });
});

describe("length hint placement", () => {
  it("centres the hint under the top's lower edge", () => {
    expect(placeLengthHint({ top: TOP, marker: null, actionRow: null, viewport: VIEWPORT })).toEqual({
      x: 500,
      y: 428,
    });
  });

  it("stays under a move marker that sticks out below a thin top", () => {
    expect(placeLengthHint({ top: TOP, marker: { x: 500, y: 415 }, actionRow: null, viewport: VIEWPORT })).toEqual({
      x: 500,
      y: 438,
    });
    expect(placeLengthHint({ top: TOP, marker: { x: 500, y: 400 }, actionRow: null, viewport: VIEWPORT }).y).toBe(428);
  });

  it.each([
    ["left", { ...TOP, left: -100, right: 100 }, 8 + LENGTH_HINT_SIZE_PX.width / 2],
    ["right", { ...TOP, left: 900, right: 1100 }, 1000 - 8 - LENGTH_HINT_SIZE_PX.width / 2],
  ])("keeps the hint inside the viewport at its %s edge", (_, top, x) => {
    expect(placeLengthHint({ top, marker: null, actionRow: null, viewport: VIEWPORT })).toEqual({ x, y: 428 });
  });

  it("keeps the hint above the viewport's bottom edge", () => {
    const top = { ...TOP, top: 760, bottom: 790 };
    expect(placeLengthHint({ top, marker: null, actionRow: null, viewport: VIEWPORT }).y).toBe(
      800 - 8 - LENGTH_HINT_SIZE_PX.height,
    );
  });

  it("clamps only to the layer's left and top edges when the frame publishes no viewport", () => {
    const top = { left: 1800, top: 4900, right: 2200, bottom: 5000 };
    expect(placeLengthHint({ top, marker: null, actionRow: null, viewport: null })).toEqual({ x: 2000, y: 5008 });
  });

  it("stays under the top when Apply / × are clear of it", () => {
    const actionRow = actionRowBox({ x: 700, y: 425 }, null);
    expect(placeLengthHint({ top: TOP, marker: null, actionRow, viewport: VIEWPORT })).toEqual({ x: 500, y: 428 });
  });

  it("goes below the Apply / × row when it would overlap the row under the top", () => {
    const actionRow = actionRowBox(ROW_ANCHOR, null);
    expect(placeLengthHint({ top: TOP, marker: null, actionRow, viewport: VIEWPORT })).toEqual({ x: 500, y: 460 });
  });

  it("goes below the reason text shown under Apply / ×", () => {
    const actionRow = actionRowBox(ROW_ANCHOR, { width: 200, height: 40 });
    expect(placeLengthHint({ top: TOP, marker: null, actionRow, viewport: VIEWPORT })).toEqual({ x: 500, y: 507 });
  });

  it("moves left of the row, under the top, when the viewport has no room below the row", () => {
    const actionRow = actionRowBox(ROW_ANCHOR, null);
    expect(placeLengthHint({ top: TOP, marker: null, actionRow, viewport: { width: 1000, height: 480 } })).toEqual({
      x: 537 - 8 - LENGTH_HINT_SIZE_PX.width / 2,
      y: 428,
    });
  });
});
