import { getEntityScreenBounds } from "./playcanvas/getEntityScreenBounds";

const DROPDOWN_OFFSET_X = 12;
export const DEFAULT_DROPDOWN_WIDTH = 200;
export const DEFAULT_DROPDOWN_HEIGHT = 300;

export type DropdownPosition = { x: number; y: number };

/**
 * Compute the position for the context dropdown relative to the PlayCanvas container.
 *
 * Strategy (in priority order):
 * 1. Right edge of the product's screen-projected bounding box
 * 2. Last known pointer position (fallback)
 * 3. Center of the container (last resort)
 */
export function getDropdownPosition(
  entityName: string,
  container: HTMLIFrameElement,
  lastPointerPos: { x: number; y: number } | null,
  size?: { width?: number; height?: number },
): DropdownPosition {
  const dropdownWidth = size?.width ?? DEFAULT_DROPDOWN_WIDTH;
  const dropdownHeight = size?.height ?? DEFAULT_DROPDOWN_HEIGHT;
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;

  // 1. Try entity screen bounds — anchor to the right edge, vertically centered
  const bounds = getEntityScreenBounds(entityName);
  let anchorX: number;
  let anchorY: number;

  if (bounds) {
    anchorX = bounds.right;
    anchorY = bounds.centerY;
  } else if (lastPointerPos) {
    anchorX = lastPointerPos.x;
    anchorY = lastPointerPos.y;
  } else {
    anchorX = containerWidth / 2;
    anchorY = containerHeight / 2;
  }

  // Shift right so the menu opens beside the anchor, not on top of it
  let x = anchorX + DROPDOWN_OFFSET_X;
  let y = anchorY;

  // Clamp so the dropdown stays within the container
  if (x + dropdownWidth > containerWidth) {
    x = anchorX - dropdownWidth - DROPDOWN_OFFSET_X;
  }
  if (y + dropdownHeight > containerHeight) {
    y = containerHeight - dropdownHeight;
  }
  if (x < 0) x = 0;
  if (y < 0) y = 0;

  return { x, y };
}
