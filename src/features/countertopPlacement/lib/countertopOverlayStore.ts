import type { CountertopOverlayFrame } from "@/features/configuratorApi";

/** Latest countertop overlay frame, outside React state (frames arrive once per rendered frame). */
export type CountertopOverlayStore = {
  get(): CountertopOverlayFrame | null;
  set(frame: CountertopOverlayFrame | null): void;
  subscribe(listener: () => void): () => void;
};

const isFrame = (value: unknown): value is CountertopOverlayFrame =>
  typeof value === "object" && value !== null && typeof (value as { visible?: unknown }).visible === "boolean";

export const createCountertopOverlayStore = (): CountertopOverlayStore => {
  let frame: CountertopOverlayFrame | null = null;
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
