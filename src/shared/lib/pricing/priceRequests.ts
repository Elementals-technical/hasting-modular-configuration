import { isCountertopTopDynamicCandidate } from "@/entities/countertop";

/**
 * How an order line asks for its price, and how the answer is read (D02/D03).
 *
 * Moved out of `usePriceCalculation` so the routing and the parsing can be fixed by tests:
 * a regression here changes the price of a SKU without changing the SKU.
 */

const parsePriceValue = (value: string | number) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value.replace(/[^0-9.-]+/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const PRICE_KEYS = ["price", "Price", "total", "Total", "amount", "Amount", "value", "Value"];

/** The price the server reports, or `null` when the answer carries none. */
export const resolvePriceFromResponse = (data?: Record<string, unknown>) => {
  if (!data) return null;

  for (const key of PRICE_KEYS) {
    const value = data[key];
    if (typeof value === "number") return parsePriceValue(value);
    if (typeof value === "string" && value.trim()) return parsePriceValue(value);
  }
  return null;
};

export type PriceRequest =
  | { kind: "product" }
  /** Vessels and book matching are priced through the v2 resolver. */
  | { kind: "productV2Resolve" }
  /** The countertop top is priced per cm, so it carries the width of the composition. */
  | { kind: "countertopTop"; widthCm: number };

export type PriceRequestInput = {
  sku: string;
  /** The width of the line, when it has one. */
  widthCm?: number | null;
  /** The countertop series prefix of the active collection (USH: "UR"). */
  countertopPrefix: string | null;
  /** `VAN-<bookMatching series>-`, from the same profile. */
  bookMatchingSkuPrefix: string | null;
  /** The line is priced per cm of `widthCm`: the top of a collection priced from its SKU profile. */
  pricedPerCm?: boolean;
};

/** A width-sensitive request identity, even when rounding leaves the rendered SKU unchanged. */
export const priceRequestCacheKey = (sku: string, widthCm?: number | null): string =>
  widthCm == null ? sku : `${sku}@${widthCm}`;

/** Keeps only the request identity whose result may currently back each SKU in the price store. */
export class LatestPriceRequestCache {
  private readonly keyBySku = new Map<string, string>();

  has(sku: string, widthCm?: number | null): boolean {
    return this.keyBySku.get(sku) === priceRequestCacheKey(sku, widthCm);
  }

  mark(sku: string, widthCm?: number | null): void {
    this.keyBySku.set(sku, priceRequestCacheKey(sku, widthCm));
  }

  clear(): void {
    this.keyBySku.clear();
  }
}

export const resolvePriceRequest = ({
  sku,
  widthCm,
  countertopPrefix,
  bookMatchingSkuPrefix,
  pricedPerCm = false,
}: PriceRequestInput): PriceRequest => {
  if (pricedPerCm && widthCm != null) return { kind: "countertopTop", widthCm };

  if (widthCm != null && countertopPrefix !== null && isCountertopTopDynamicCandidate(sku, widthCm, countertopPrefix)) {
    return { kind: "countertopTop", widthCm };
  }

  const isVesselSku = sku.startsWith("VES-");
  const isBookMatchingSku = bookMatchingSkuPrefix !== null && sku.startsWith(bookMatchingSkuPrefix);

  return isVesselSku || isBookMatchingSku ? { kind: "productV2Resolve" } : { kind: "product" };
};
