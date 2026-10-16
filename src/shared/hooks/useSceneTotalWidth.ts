import { useEffect, useState } from "react";

import { getConfig } from "@/utils/functions/playcanvas/getConfig";
import { getOrderedProductIds } from "@/utils/functions/playcanvas/getOrderedProductIds";

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }

  if (value && typeof value === "object") {
    const firstKey = Object.keys(value as Record<string, unknown>)[0];
    if (firstKey) {
      const parsed = Number(firstKey.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
};

const extractWidthFromConfig = (config: Record<string, unknown> | null): number | null => {
  if (!config) return null;
  return toFiniteNumber(config.Width);
};

/** A placed cabinet's width (cm) and, when the scene names it, the centre of its place along the wall (m). */
export type PlacedWidth = { widthCm: number; centreXM: number | null };

/**
 * The length a composition takes along the wall, in cm. Cabinets at one place, one over the
 * other (a column of Urban Duplex), count once; a shifted one adds what sticks out. Without the
 * scene's positions it is the sum of the widths, the length of one row.
 */
export const occupiedWidthCm = (cabinets: readonly PlacedWidth[]): number => {
  const spans = cabinets.flatMap(({ widthCm, centreXM }): [number, number][] =>
    centreXM === null ? [] : [[centreXM * 100 - widthCm / 2, centreXM * 100 + widthCm / 2]],
  );
  if (spans.length !== cabinets.length) return cabinets.reduce((sum, { widthCm }) => sum + widthCm, 0);

  const merged: [number, number][] = [];
  for (const [from, to] of spans.sort(([left], [right]) => left - right)) {
    const last = merged.at(-1);
    // Overlapping along the wall: one place of the row.
    if (last && from < last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }

  return Math.round(merged.reduce((sum, [from, to]) => sum + to - from, 0) * 100) / 100;
};

export const useSceneTotalWidth = (selectedProducts: string[], fallbackWidth: number | null = null): number | null => {
  const [totalWidth, setTotalWidth] = useState<number | null>(fallbackWidth);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const orderedIds = getOrderedProductIds(selectedProducts);

      if (!orderedIds.length) {
        if (!cancelled) setTotalWidth(fallbackWidth);
        return;
      }

      const configs = await Promise.all(orderedIds.map((id) => getConfig(id)));
      const placed = configs.flatMap((config): PlacedWidth[] => {
        if (!config || typeof config !== "object") return [];
        const record = config as Record<string, unknown>;
        const widthCm = extractWidthFromConfig(record);
        return widthCm === null ? [] : [{ widthCm, centreXM: toFiniteNumber(record.positionX) }];
      });

      if (cancelled) return;

      if (!placed.length) {
        // Keep the last reliable scene total when PlayCanvas temporarily returns
        // configs without Width. Fallback is only for the initial unresolved state.
        setTotalWidth((prev) => prev ?? fallbackWidth);
        return;
      }

      const sum = occupiedWidthCm(placed);
      const nextValue = Number.isFinite(sum) ? sum : fallbackWidth;
      setTotalWidth((prev) => {
        if (prev === null && nextValue === null) return prev;
        if (typeof prev === "number" && typeof nextValue === "number" && Math.abs(prev - nextValue) < 0.01) {
          return prev;
        }
        return nextValue;
      });
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 350);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fallbackWidth, selectedProducts]);

  return totalWidth;
};
