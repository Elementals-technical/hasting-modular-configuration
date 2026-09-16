import type { RuntimeBindingSet } from "@/entities/collection";

/**
 * Synchronous boundary for non-React scene services.
 *
 * The active-collection loader owns fetching and validation. This module only mirrors
 * the currently ready table for history code that cannot use React context.
 */
let active: { collectionId: string; bindings: RuntimeBindingSet } | null = null;

export const replaceLoadedRuntimeBindings = (
  collectionId: string | null,
  bindings: RuntimeBindingSet | null,
): void => {
  active = collectionId && bindings ? { collectionId, bindings } : null;
};

/** The active collection's validated table, or null when it does not declare one. */
export const getLoadedRuntimeBindings = (collectionId: string): RuntimeBindingSet | null =>
  active?.collectionId === collectionId ? active.bindings : null;

/** For tests: forget the active table. */
export const resetRuntimeBindingsCache = (): void => {
  active = null;
};
