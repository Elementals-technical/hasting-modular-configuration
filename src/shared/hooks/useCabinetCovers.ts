import { useSyncExternalStore } from "react";

import { isLiftedCountertop } from "@/features/configuratorApi";
import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import {
  getCabinetCoverRuntime,
  subscribeCabinetCoverRuntime,
  type CabinetCoverSize,
} from "@/shared/lib/cabinetCoverRuntime";

/**
 * The cover slabs the order prices: only while the countertop is lifted off its cabinets, as the
 * scene covers their tops then. Null otherwise, or before the scene reports them.
 */
export const useCabinetCovers = (): readonly CabinetCoverSize[] | null => {
  // Primitive selectors: a drag frame must not re-run pricing.
  const lifted = useCountertopRuntimeValue((state) => state?.readiness === "ready" && isLiftedCountertop(state));
  const compositionId = useCountertopRuntimeValue((state) => state?.compositionId ?? null);
  const runtime = useSyncExternalStore(subscribeCabinetCoverRuntime, getCabinetCoverRuntime, getCabinetCoverRuntime);

  if (!lifted || !runtime || runtime.compositionId !== compositionId) return null;
  return runtime.covers.length > 0 ? runtime.covers : null;
};
