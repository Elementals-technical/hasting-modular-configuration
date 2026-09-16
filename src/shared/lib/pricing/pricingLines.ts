import type { PricingLine } from "./types";

/** The SKU of every piece, in line order — the list the price requests and the total are counted over. */
export const expandLineSkus = (lines: readonly PricingLine[]): string[] =>
  lines.flatMap(({ sku, quantity }) => Array.from({ length: quantity }, () => sku));
