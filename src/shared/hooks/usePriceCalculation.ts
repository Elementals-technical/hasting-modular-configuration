import { useEffect, useMemo, useRef } from "react";

import { useAppDispatch } from "@/shared/hooks/store/redux";
import { useLazyGetCountertopTopPriceBySkuQuery, type CountertopSkuPriceResponse } from "@/entities/countertop/api";
import {
  useLazyGetProductPriceBySkuQuery,
  useLazyGetProductPriceBySkuV2ResolveQuery,
  type ProductSkuPriceResponse,
} from "@/entities/product/api";
import {
  setPriceLoading,
  setPricingLines,
  setPricingUnavailable,
  setSkuPriceEntries,
  setSkusLoading,
  type SkuPriceEntry,
} from "@/entities/product/model/store/priceStore";
import { usePricingInput } from "@/shared/hooks/usePricingInput";
import { buildPricingLines, expandLineSkus, resolvePriceFromResponse, resolvePriceRequest } from "@/shared/lib/pricing";

// ── Hook ────────────────────────────────────────────────

const DEBOUNCE_MS = 300;
const LOG_PREFIX = "[SKU/Price]";

/**
 * Builds the order lines of the active configuration and prices them (D02).
 *
 * Mounted once in the configurator sidebar. The lines come from `buildPricingLines`; each SKU
 * is requested once however many pieces use it, and every answer is recorded — a price, a
 * missing price or an error — so the UI can tell a complete total from an incomplete one.
 */
export function usePriceCalculation() {
  const dispatch = useAppDispatch();
  const [triggerPriceBySku] = useLazyGetProductPriceBySkuQuery();
  const [triggerPriceBySkuV2Resolve] = useLazyGetProductPriceBySkuV2ResolveQuery();
  const [triggerCountertopTopPriceBySku] = useLazyGetCountertopTopPriceBySkuQuery();
  const { input, canCalculate, refreshSceneConfigs } = usePricingInput();
  const { skuBuilders } = input;

  // A collection without an SKU profile gets no SKUs and no price requests (D01).
  useEffect(() => {
    if (skuBuilders.status === "unsupported" && skuBuilders.reason !== "no-collection") {
      console.warn(LOG_PREFIX, "SKUs are unavailable for this collection:", skuBuilders.reason);
    }
  }, [skuBuilders.reason, skuBuilders.status]);

  // ── Build the order lines ─────────────────────────────

  const lines = useMemo(() => (canCalculate ? buildPricingLines(input) : []), [canCalculate, input]);
  const currentSkus = useMemo(() => expandLineSkus(lines), [lines]);

  // ── Stable key for the lines (avoid effect re-runs on same content) ─

  const linesKey = lines.map(({ id, sku, quantity }) => `${id}=${sku}*${quantity}`).join("|");
  const countertopPrefix = skuBuilders.profile?.series.countertopPrefix ?? null;
  // Book matching is priced through the v2 resolver; recognised by the collection series, not a USH literal.
  const bookMatchingSkuPrefix = skuBuilders.profile ? `VAN-${skuBuilders.profile.series.bookMatching}-` : null;
  const widthCmBySku = useMemo(
    () => new Map(lines.flatMap(({ sku, widthCm }) => (widthCm != null ? [[sku, widthCm] as const] : []))),
    [lines],
  );

  // ── Fetch prices for new/changed SKUs ─────────────────

  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (skuBuilders.status !== "ready") {
      dispatch(setPricingUnavailable());
      return;
    }

    if (!canCalculate || !lines.length) {
      dispatch(setPricingLines([]));
      dispatch(setPriceLoading(false));
      return;
    }

    dispatch(setPricingLines(lines));

    const pending = [...new Set(currentSkus.filter((sku) => !fetchedRef.current.has(sku)))];
    if (!pending.length) {
      dispatch(setPriceLoading(false));
      return;
    }
    dispatch(setPriceLoading(true));
    dispatch(setSkusLoading(pending));

    const timer = setTimeout(() => {
      // Mark immediately to prevent duplicate fetches
      pending.forEach((sku) => fetchedRef.current.add(sku));

      const loadPrices = async () => {
        const next: Record<string, SkuPriceEntry> = {};

        try {
          await Promise.all(
            pending.map(async (sku) => {
              try {
                console.log(LOG_PREFIX, "Fetching price for:", sku);

                const request = resolvePriceRequest({
                  sku,
                  widthCm: widthCmBySku.get(sku),
                  countertopPrefix,
                  bookMatchingSkuPrefix,
                });

                let data: ProductSkuPriceResponse | CountertopSkuPriceResponse;

                if (request.kind === "countertopTop") {
                  data = await triggerCountertopTopPriceBySku({ sku, widthCm: request.widthCm }).unwrap();
                } else if (request.kind === "productV2Resolve") {
                  data = await triggerPriceBySkuV2Resolve({ sku }).unwrap();
                } else {
                  data = await triggerPriceBySku(sku).unwrap();
                }

                console.log(LOG_PREFIX, "Response for", sku, "→", data);

                const price = resolvePriceFromResponse(data);
                next[sku] = typeof price === "number" ? { status: "ready", value: price } : { status: "missing" };
              } catch (err) {
                console.warn(LOG_PREFIX, "Price fetch failed for", sku, err);
                next[sku] = { status: "error", message: err instanceof Error ? err.message : "Price request failed" };
              }
            }),
          );
        } finally {
          dispatch(setPriceLoading(false));
        }

        console.log(LOG_PREFIX, "Resolved prices:", next);
        dispatch(setSkuPriceEntries(next));
      };

      loadPrices();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    linesKey,
    canCalculate,
    skuBuilders.status,
    bookMatchingSkuPrefix,
    countertopPrefix,
    dispatch,
    triggerPriceBySku,
    triggerPriceBySkuV2Resolve,
    triggerCountertopTopPriceBySku,
  ]);

  // ── Re-fetch scene configs when product options change ─
  // (user changed color, handle, etc. → configs on PlayCanvas are updated)

  useEffect(() => {
    const hasExtraProducts = input.shouldUsePresets
      ? input.productIds.length > input.productsPresets.length
      : input.productIds.length > 0;
    if (!hasExtraProducts) return;

    const timer = setTimeout(() => {
      // Clear price cache so new SKUs get fetched
      fetchedRef.current.clear();
      refreshSceneConfigs();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    input.cabinetColor,
    input.cabinetColorSku,
    input.handleGrooveColor,
    input.handleGrooveColorSku,
    input.countertopColor,
    input.countertopColorSku,
    input.countertopStyle,
    input.countertopThickness,
    input.vesselColor,
    input.sinkType,
    input.faucetHolesAmount,
    input.selectedProductConfig?.Handle,
    input.selectedProductConfig?.Drawers,
    input.drawerPanelFluting,
    input.selectedDimensions.width,
    input.selectedDimensions.height,
    input.selectedDimensions.depth,
    input.cabinetEntries,
    input.dimensionsByCabinet,
  ]);
}
