import type { PlacementOverlayPoint } from "@/features/configuratorApi";

import { within } from "../../lib/screenGeometry";

/** Half the height of the dimension chip the popover points at (16 px line, 2 px padding). */
const CHIP_HALF_HEIGHT_PX = 10;
/** Between the chip and the popover; the tail sits in it. */
const GAP_PX = 18;
/** The tail's distance from the popover's left edge: the popover opens to the right of the chip. */
const TAIL_INSET_PX = 48;
const TAIL_EDGE_PX = 16;
const EDGE_PX = 8;

type Size = { width: number; height: number };
type Bounds = { left: number; top: number; right: number; bottom: number };
export type DimensionPopoverPlacement = {
  left: number;
  top: number;
  side: "above" | "below" | "over";
  tailLeft: number;
};

/**
 * Where the dimension popover goes, in window px: above the chip, else below it, else over it
 * (bounds too low for both); always inside `bounds` (the canvas across, the window down), with the
 * tail over the chip.
 */
export const placeDimensionPopover = (
  chip: PlacementOverlayPoint,
  popover: Size,
  bounds: Bounds,
): DimensionPopoverPlacement => {
  const left = within(chip.x - TAIL_INSET_PX, bounds.left + EDGE_PX, bounds.right - popover.width - EDGE_PX);
  const topAbove = chip.y - CHIP_HALF_HEIGHT_PX - GAP_PX - popover.height;
  const topBelow = chip.y + CHIP_HALF_HEIGHT_PX + GAP_PX;
  const side =
    topAbove >= bounds.top + EDGE_PX
      ? "above"
      : topBelow + popover.height <= bounds.bottom - EDGE_PX
        ? "below"
        : "over";
  const top =
    side === "above"
      ? topAbove
      : side === "below"
        ? topBelow
        : within(topAbove, bounds.top + EDGE_PX, bounds.bottom - popover.height - EDGE_PX);
  return { left, top, side, tailLeft: within(chip.x - left, TAIL_EDGE_PX, popover.width - TAIL_EDGE_PX) };
};
