import { useMemo } from "react";

import {
  getPriceEntries,
  getPriceStatus,
  getPriceTotal,
  getPricingLines,
} from "@/entities/product/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";

/**
 * The priced order for UI (D02): the lines, the price of each SKU, the total and its status.
 * Filled by `usePriceCalculation`; the sidebar, the bottom bar and both Summary pages read it.
 */
export const usePriceResult = () => {
  const lines = useAppSelector(getPricingLines);
  const entries = useAppSelector(getPriceEntries);
  const total = useAppSelector(getPriceTotal);
  const status = useAppSelector(getPriceStatus);

  return useMemo(
    () => ({
      lines,
      total,
      status,
      lineById: (id: string) => lines.find((line) => line.id === id) ?? null,
      priceOf: (sku: string) => entries[sku] ?? null,
    }),
    [entries, lines, status, total],
  );
};
