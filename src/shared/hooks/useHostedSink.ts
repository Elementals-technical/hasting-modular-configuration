import { useEffect, useState } from "react";

import { useCountertopRuntimeValue } from "@/shared/hooks/useCountertopRuntimeState";
import type { PricingInput } from "@/shared/lib/pricing";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

type HostedSink = NonNullable<PricingInput["hostedSink"]>;

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/** The countertop's `CountertopSinkType` / `VesselColor` while `sink.hosted`; null otherwise. */
export const useHostedSink = (): HostedSink | null => {
  // Primitive selectors: a drag frame must not re-run pricing.
  const hosted = useCountertopRuntimeValue((state) => state?.sink?.hosted === true);
  const productId = useCountertopRuntimeValue((state) => state?.productId ?? null);
  const [hostedSink, setHostedSink] = useState<HostedSink | null>(null);

  useEffect(() => {
    if (!hosted || !productId) {
      setHostedSink(null);
      return;
    }
    let cancelled = false;
    Promise.resolve(getConfig(productId))
      .then((raw) => {
        const config = (raw ?? {}) as Record<string, unknown>;
        if (!cancelled) {
          setHostedSink({ sinkType: str(config.CountertopSinkType), vesselColor: str(config.VesselColor) });
        }
      })
      .catch(() => !cancelled && setHostedSink(null));
    return () => {
      cancelled = true;
    };
  }, [hosted, productId]);

  return hostedSink;
};
