import type { OrganizersOverlayFrame } from "@/features/configuratorApi";

/**
 * Latest organizer overlay frame, outside React state (frames arrive once per rendered frame). Read with
 * `useSyncExternalStore`; a copy of `countertopOverlayStore`.
 */
export type OrganizerOverlayStore = {
  get(): OrganizersOverlayFrame | null;
  set(frame: OrganizersOverlayFrame | null): void;
  subscribe(listener: () => void): () => void;
};

const isFrame = (value: unknown): value is OrganizersOverlayFrame =>
  typeof value === "object" && value !== null && typeof (value as { visible?: unknown }).visible === "boolean";

export const createOrganizerOverlayStore = (): OrganizerOverlayStore => {
  let frame: OrganizersOverlayFrame | null = null;
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

/** The one store the runtime writes (`useOrganizerRuntime`) and the canvas layer reads. */
export const organizerOverlayStore = createOrganizerOverlayStore();
