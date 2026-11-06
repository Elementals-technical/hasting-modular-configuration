import { useEffect, useState } from "react";

import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

type SinkBaseDimensions = { width: number | null; depth: number | null };

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

/**
 * Returns { width, depth } of the narrowest Sink Base cabinet on the scene: a composition's basin goes on every Sink
 * Base, so the countertop rules judge it by the one that limits it.
 * Returns { width: null, depth: null } when no SB is present.
 * `isSinkBase` tells a Sink Base by its runtime id, which only the collection's bindings can read.
 */
export function useSinkBaseDimensions(
  selectedProducts: string[],
  isSinkBase: (runtimeId: string) => boolean,
): SinkBaseDimensions {
  const [dims, setDims] = useState<SinkBaseDimensions>({ width: null, depth: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const orderedIds = getOrderedProductIds(selectedProducts);
      if (!orderedIds.length) {
        if (!cancelled) setDims({ width: null, depth: null });
        return;
      }

      const configs = await Promise.all(orderedIds.map((id) => getConfig(id)));

      let narrowestWidth: number | null = null;
      let narrowestDepth: number | null = null;

      configs.forEach((config, index) => {
        if (!config || !isSinkBase(orderedIds[index])) return;

        const w = toFiniteNumber((config as Record<string, unknown>).Width);
        const d = toFiniteNumber((config as Record<string, unknown>).Depth);

        if (w !== null && (narrowestWidth === null || w < narrowestWidth)) {
          narrowestWidth = w;
          narrowestDepth = d;
        }
      });

      if (cancelled) return;

      setDims((prev) => {
        if (prev.width === narrowestWidth && prev.depth === narrowestDepth) return prev;
        return { width: narrowestWidth, depth: narrowestDepth };
      });
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 350);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isSinkBase, selectedProducts]);

  return dims;
}
