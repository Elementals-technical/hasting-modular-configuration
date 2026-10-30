import type { CountertopState } from "@/features/configuratorApi";

/**
 * The live `ConfiguratorAPI.countertop.getState()`, published by the one `countertop.on('change')`
 * subscriber in PlayCanvasIntegration. Read it here (or with `useCountertopRuntimeState`) instead of
 * subscribing again. Unlike `countertopRuntimeSize` it also updates while the top is being edited.
 */
type Listener = () => void;

let snapshot: CountertopState | null = null;
const listeners = new Set<Listener>();

export const getCountertopRuntimeState = (): CountertopState | null => snapshot;

export const subscribeCountertopRuntimeState = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setCountertopRuntimeState = (next: CountertopState | null): void => {
  if (snapshot === next) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};
