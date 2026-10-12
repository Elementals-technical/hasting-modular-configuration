import { useSyncExternalStore } from "react";

import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import {
  getCabinetCoverRuntime,
  subscribeCabinetCoverRuntime,
  type CabinetCoverSize,
} from "@/shared/lib/cabinetCoverRuntime";

/**
 * Price the actual covers, including multi-level presets whose upper top has zero offset.
 * Match the active composition; the upper's pose does not tell us whether Lower exists.
 */
export const useCabinetCovers = (): readonly CabinetCoverSize[] | null => {
  // Primitive selectors: a drag frame must not re-run pricing.
  const ready = useCountertopRuntimeValue((state) => state?.readiness === "ready");
  const compositionId = useCountertopRuntimeValue((state) => state?.compositionId ?? null);
  const runtime = useSyncExternalStore(subscribeCabinetCoverRuntime, getCabinetCoverRuntime, getCabinetCoverRuntime);

  if (!ready || !runtime || runtime.compositionId !== compositionId) return null;
  return runtime.covers.length > 0 ? runtime.covers : null;
};
