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

const containsSinkBase = (value: unknown, visited = new Set<unknown>()): boolean => {
  if (!value || visited.has(value)) return false;

  if (typeof value === "string") {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return normalized.includes("sinkbase");
  }

  if (typeof value !== "object") return false;
  visited.add(value);

  if (Array.isArray(value)) {
    return value.some((entry) => containsSinkBase(entry, visited));
  }

  return Object.values(value as Record<string, unknown>).some((entry) =>
    containsSinkBase(entry, visited),
  );
};

/**
 * Returns { width, depth } of the largest Sink Base cabinet on the scene.
 * When multiple SB cabinets exist, picks the one with the greatest width.
 * Returns { width: null, depth: null } when no SB is present.
 */
export function useSinkBaseDimensions(selectedProducts: string[]): SinkBaseDimensions {
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

      let bestWidth: number | null = null;
      let bestDepth: number | null = null;

      configs.forEach((config) => {
        if (!config || !containsSinkBase(config)) return;

        const w = toFiniteNumber((config as Record<string, unknown>).Width);
        const d = toFiniteNumber((config as Record<string, unknown>).Depth);

        if (w !== null && (bestWidth === null || w > bestWidth)) {
          bestWidth = w;
          bestDepth = d;
        }
      });

      if (cancelled) return;

      setDims((prev) => {
        if (prev.width === bestWidth && prev.depth === bestDepth) return prev;
        return { width: bestWidth, depth: bestDepth };
      });
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 350);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedProducts]);

  return dims;
}
