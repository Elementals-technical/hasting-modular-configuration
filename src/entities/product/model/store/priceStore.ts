import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { expandLineSkus } from "@/shared/lib/pricing/pricingLines";
import type { PricingGap, PricingLine } from "@/shared/lib/pricing/types";

/** What is known about the price of one SKU. */
export type SkuPriceEntry =
  | { status: "loading" }
  | { status: "ready"; value: number }
  /** The server answered without a price. */
  | { status: "missing" }
  | { status: "error"; message: string };

/**
 * Price of the whole order.
 * `unavailable`: the collection has no SKU profile. `partial`: some lines have no price, or the
 * order uses a part the collection has not confirmed — the total must not be shown as complete.
 */
export type PriceStatus = "idle" | "unavailable" | "loading" | "ready" | "partial";

type PriceState = {
  skuPrices: Record<string, number>;
  /** The SKU of every piece of `lines`, in order. */
  activeSkus: string[];
  total: number;
  isLoading: boolean;
  lines: PricingLine[];
  entries: Record<string, SkuPriceEntry>;
  isUnavailable: boolean;
  /** Unconfirmed parts the current order uses (D04). */
  gaps: PricingGap[];
};

const calculateTotal = (prices: Record<string, number>, activeSkus: string[]) =>
  activeSkus.reduce((sum, sku) => sum + (prices[sku] ?? 0), 0);

const initialState: PriceState = {
  skuPrices: {},
  activeSkus: [],
  total: 0,
  isLoading: false,
  lines: [],
  entries: {},
  isUnavailable: false,
  gaps: [],
};

export const derivePriceStatus = ({
  isUnavailable,
  isLoading,
  lines = [],
  entries = {},
  gaps = [],
}: Pick<PriceState, "isUnavailable" | "isLoading" | "lines" | "entries"> &
  Partial<Pick<PriceState, "gaps">>): PriceStatus => {
  if (isUnavailable) return "unavailable";
  if (lines.length === 0) return "idle";

  const statuses = lines.map(({ sku }) => entries[sku]?.status);
  if (isLoading || statuses.some((status) => status === undefined || status === "loading")) return "loading";

  const isComplete = statuses.every((status) => status === "ready") && !gaps.some(({ blocksTotal }) => blocksTotal);
  return isComplete ? "ready" : "partial";
};

const priceStoreSlice = createSlice({
  name: "PriceStore",
  initialState,
  reducers: {
    setActiveSkus(state, action: PayloadAction<string[]>) {
      state.activeSkus = action.payload;
      state.total = calculateTotal(state.skuPrices, state.activeSkus);
    },
    /** The order lines of the current configuration; the priced SKU list follows them. */
    setPricingLines(state, action: PayloadAction<PricingLine[]>) {
      state.lines = action.payload;
      state.activeSkus = expandLineSkus(action.payload);
      state.isUnavailable = false;
      state.total = calculateTotal(state.skuPrices, state.activeSkus);
    },
    setPricingGaps(state, action: PayloadAction<PricingGap[]>) {
      state.gaps = action.payload;
    },
    /** The active collection cannot be priced: no lines, no total. */
    setPricingUnavailable(state) {
      state.gaps = [];
      state.lines = [];
      state.activeSkus = [];
      state.total = 0;
      state.isLoading = false;
      state.isUnavailable = true;
    },
    setSkusLoading(state, action: PayloadAction<string[]>) {
      state.entries = state.entries ?? {};
      action.payload.forEach((sku) => {
        state.entries[sku] = { status: "loading" };
      });
    },
    setSkuPriceEntries(state, action: PayloadAction<Record<string, SkuPriceEntry>>) {
      state.entries = { ...state.entries, ...action.payload };
      Object.entries(action.payload).forEach(([sku, entry]) => {
        if (entry.status === "ready") {
          state.skuPrices[sku] = entry.value;
        } else {
          delete state.skuPrices[sku];
        }
      });
      state.total = calculateTotal(state.skuPrices, state.activeSkus);
    },
    setSkuPrices(state, action: PayloadAction<Record<string, number>>) {
      state.skuPrices = { ...state.skuPrices, ...action.payload };
      state.entries = {
        ...state.entries,
        ...Object.fromEntries(
          Object.entries(action.payload).map(([sku, value]) => [sku, { status: "ready" as const, value }]),
        ),
      };
      state.total = calculateTotal(state.skuPrices, state.activeSkus);
    },
    setPriceLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    resetPrices() {
      return initialState;
    },
  },
});

export const {
  setActiveSkus,
  setPricingLines,
  setPricingGaps,
  setPricingUnavailable,
  setSkusLoading,
  setSkuPriceEntries,
  setSkuPrices,
  setPriceLoading,
  resetPrices,
} = priceStoreSlice.actions;
export const priceStoreReducer = priceStoreSlice.reducer;
