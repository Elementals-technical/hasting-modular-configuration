import type { PlacementOverlayPoint } from "@/features/configuratorApi";

import { MOVE_MARKER_HALF_PX } from "./lengthHintPlacement";
import { overlaps } from "./screenGeometry";
import type { ScreenBox } from "./screenGeometry";

/**
 * The length chip's box, centred on its point (`translate(-50%, -50%)`): 20 px tall (16 px line, 2 px
 * padding); its width is a six-glyph label's ("119.5″ ✎" renders at about 65 px, "60.4″ ✎" at 58 px),
 * rounded up, so the check stays on the safe side without measuring the DOM.
 */
export const LENGTH_CHIP_SIZE_PX = { width: 72, height: 20 };
/** Kept between the Edit size button and the chip or the marker moved off it. */
const BUTTON_GAP_PX = 4;

type Clearance = {
  /** The length chip's centre, when it is drawn. */
  chip: PlacementOverlayPoint | null;
  /** The move marker's centre, when it is drawn. */
  marker: PlacementOverlayPoint | null;
};

const boxAt = (point: PlacementOverlayPoint, halfWidth: number, halfHeight: number): ScreenBox => ({
  left: point.x - halfWidth,
  top: point.y - halfHeight,
  right: point.x + halfWidth,
  bottom: point.y + halfHeight,
});

/**
 * The length chip and the move marker kept off the scene's Edit size button, in iframe px: a chip that
 * would cover the button (or come within the gap of it) goes right above it, a marker right below it,
 * both at the same `x`. Without a button, or clear of it, they stay where they are.
 */
export const clearEditSizeButton = (button: ScreenBox | null, { chip, marker }: Clearance): Clearance => {
  if (!button) return { chip, marker };
  const keepOut = {
    left: button.left - BUTTON_GAP_PX,
    top: button.top - BUTTON_GAP_PX,
    right: button.right + BUTTON_GAP_PX,
    bottom: button.bottom + BUTTON_GAP_PX,
  };
  const chipHalfWidth = LENGTH_CHIP_SIZE_PX.width / 2;
  const chipHalfHeight = LENGTH_CHIP_SIZE_PX.height / 2;
  return {
    chip:
      chip && overlaps(boxAt(chip, chipHalfWidth, chipHalfHeight), keepOut)
        ? { x: chip.x, y: keepOut.top - chipHalfHeight }
        : chip,
    marker:
      marker && overlaps(boxAt(marker, MOVE_MARKER_HALF_PX, MOVE_MARKER_HALF_PX), keepOut)
        ? { x: marker.x, y: keepOut.bottom + MOVE_MARKER_HALF_PX }
        : marker,
  };
};
