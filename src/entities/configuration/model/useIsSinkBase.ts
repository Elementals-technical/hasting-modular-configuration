import { useCallback } from "react";

import { isSinkBaseRuntimeId } from "@/entities/collection";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { getActiveProductProfile, getActiveRuntimeBindings } from "./store/selectors";

/**
 * Whether a placed product is a Sink Base of the active collection, for hooks that read the scene
 * by runtime id. The scene names a product after its scene type (`Mako-sink-cabinet-…`), so the
 * collection's bindings tell it, not a "sink-base" in the id or in the scene config.
 */
export const useIsSinkBase = (): ((runtimeId: string) => boolean) => {
  const profile = useAppSelector(getActiveProductProfile);
  const bindings = useAppSelector(getActiveRuntimeBindings);

  return useCallback((runtimeId: string) => isSinkBaseRuntimeId(profile, bindings, runtimeId), [bindings, profile]);
};
