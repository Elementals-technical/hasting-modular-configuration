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
      const widths = configs
        .map((config) => (config && typeof config === "object" ? extractWidthFromConfig(config as Record<string, unknown>) : null))
        .filter((value): value is number => typeof value === "number");

      if (cancelled) return;

      if (!widths.length) {
        setTotalWidth(fallbackWidth);
        return;
      }

      const sum = widths.reduce((acc, width) => acc + width, 0);
      setTotalWidth(Number.isFinite(sum) ? sum : fallbackWidth);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fallbackWidth, selectedProducts]);

  return totalWidth;
};
