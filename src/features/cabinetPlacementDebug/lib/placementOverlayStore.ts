import type { PlacementOverlayFrame } from "@/features/configuratorApi";

/**
 * Latest draft overlay frame. Frames arrive up to once per rendered frame (camera orbit, drag), so
 * they live outside React state: only the overlay subscribes to every frame
 * (useSyncExternalStore), the controls read derived primitives that rarely change.
 */
export type PlacementOverlayStore = {
  get(): PlacementOverlayFrame | null;
  set(frame: PlacementOverlayFrame | null): void;
  subscribe(listener: () => void): () => void;
};

const isFrame = (value: unknown): value is PlacementOverlayFrame => {
  if (typeof value !== "object" || value === null) return false;
  const frame = value as Record<string, unknown>;
  return typeof frame.sessionId === "string" && typeof frame.visible === "boolean";
};

export const createPlacementOverlayStore = (): PlacementOverlayStore => {
  let frame: PlacementOverlayFrame | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => frame,
    set(next) {
      const value = isFrame(next) ? next : null;
      if (value === frame) return;
      frame = value;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** The overlay anchors of `sessionId`, when PlayCanvas can place them on screen. */
export const visibleOverlayFrame = (
  frame: PlacementOverlayFrame | null,
  sessionId: string | null,
): PlacementOverlayFrame | null =>
  frame && sessionId && frame.sessionId === sessionId && frame.visible && frame.points ? frame : null;

/**
 * Where the Apply / discard pair goes: under the cabinet's bottom-right corner, kept inside the
 * viewport (Apply is ~60 px wide to the left of the anchor, discard ~25 px to the right, both
 * ~25 px tall) so a zoomed-in or edge-dragged cabinet never hides them.
 */
export const actionAnchor = (frame: PlacementOverlayFrame): { x: number; y: number } | null => {
  const corner = frame.points?.bottomRight;
  if (!corner) return null;
  const width = frame.viewport?.width || Infinity;
  const height = frame.viewport?.height || Infinity;
  return {
    x: Math.min(Math.max(corner.x, 64), width - 30),
    y: Math.min(Math.max(corner.y, 0), height - 30),
  };
};
