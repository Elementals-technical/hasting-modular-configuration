import { useSyncExternalStore } from "react";

import type { CountertopState } from "@/features/configuratorApi";
import { getCountertopRuntimeState, subscribeCountertopRuntimeState } from "@/shared/lib/countertopRuntimeState";

/** Live countertop state (null until PlayCanvas binds a top). Re-renders on every change, drag frames included. */
export const useCountertopRuntimeState = (): CountertopState | null =>
  useSyncExternalStore(subscribeCountertopRuntimeState, getCountertopRuntimeState, getCountertopRuntimeState);

/** One primitive of the live state: re-renders only when that value changes (not on every drag frame). */
export const useCountertopRuntimeValue = <T extends string | number | boolean | null>(
  select: (state: CountertopState | null) => T,
): T => {
  const read = () => select(getCountertopRuntimeState());
  return useSyncExternalStore(subscribeCountertopRuntimeState, read, read);
};
