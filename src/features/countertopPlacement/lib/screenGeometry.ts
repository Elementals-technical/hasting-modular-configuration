/** An axis-aligned box in CSS px; the caller says which viewport (the iframe's or the window's). */
export type ScreenBox = { left: number; top: number; right: number; bottom: number };

/** `value` kept within `[min, max]`; `min` wins when the range is empty. */
export const within = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Whether two boxes share an area; boxes that only touch along an edge don't. */
export const overlaps = (a: ScreenBox, b: ScreenBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
