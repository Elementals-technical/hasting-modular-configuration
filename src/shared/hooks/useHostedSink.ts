import { useEffect, useState } from "react";

import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import type { PricingInput } from "@/shared/lib/pricing";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

type HostedSink = NonNullable<PricingInput["hostedSinks"]>[number];

const EMPTY: readonly HostedSink[] = Object.freeze([]);
const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/**
 * The basins the countertop itself carries while `sink.hosted` (HR-CT-02 / HR-CT-05) — none otherwise.
 *
 * A top holds up to two of them, so this is a list: after the sink base under a long top is deleted, its basin
 * passes to the top and the order has to show both. The styles come from `state.basins`, which the scene lists by
 * what the top OWNS, not by what it has measured — a basin must not drop out of the price for the frames between
 * its config landing and its cut-out being built. The colour is the top's own and is shared by its basins.
 */
export const useHostedSinks = (): readonly HostedSink[] => {
  // Primitive selectors: a drag frame must not re-run pricing, and `state.basins` is a fresh array on every read.
  const hosted = useCountertopRuntimeValue((state) => state?.sink?.hosted === true);
  const productId = useCountertopRuntimeValue((state) => state?.productId ?? null);
  const stylesKey = useCountertopRuntimeValue((state) =>
    (state?.basins ?? []).map((basin) => basin.style ?? "").join("|"),
  );
  const [hostedSinks, setHostedSinks] = useState<readonly HostedSink[]>(EMPTY);

  useEffect(() => {
    const styles = stylesKey.split("|").filter(Boolean);
    if (!hosted || !productId || styles.length === 0) {
      setHostedSinks(EMPTY);
      return;
    }
    let cancelled = false;
    Promise.resolve(getConfig(productId))
      .then((raw) => {
        const config = (raw ?? {}) as Record<string, unknown>;
        const vesselColor = str(config.VesselColor);
        if (!cancelled) setHostedSinks(styles.map((sinkType) => ({ sinkType, vesselColor })));
      })
      .catch(() => !cancelled && setHostedSinks(EMPTY));
    return () => {
      cancelled = true;
    };
  }, [hosted, productId, stylesKey]);

  return hostedSinks;
};
