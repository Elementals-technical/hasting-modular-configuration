import { useCallback, useEffect, useState } from "react";

import { resolveCabinetDimensions } from "@/entities/configuration/model/identity";
import { getCabinetEntries, getDimensionsByCabinet } from "@/entities/configuration/model/store/selectors";
import {
  getHasBootstrappedCabinetBuilder,
  getProductsPresets,
  getSelectedDimensions,
  getSelectedProducts,
} from "@/entities/product/model/store/selectors";
import { useAppSelector } from "@/shared/hooks/store/redux";
import {
  normalizeProductConfigSnapshot,
  type NormalizedProductConfigSnapshot,
} from "@/shared/lib/normalizeProductConfigSnapshot";
import { getConfig } from "@/utils/functions/playcanvas/getConfig";

const LOG_PREFIX = "[SKU/Price]";

/**
 * Per-product configs the order lines are built from (D02).
 *
 * The cabinet type, drawers and handle of each product still live only in the scene, so they
 * are read from it here; its size comes from C's recorded dimensions (I04). Moved from
 * `usePriceCalculation`; `refresh` re-reads after an option changed the scene.
 */
export const useSceneProductConfigs = () => {
  const productIds = useAppSelector(getSelectedProducts);
  const productsPresets = useAppSelector(getProductsPresets);
  const hasBootstrappedCabinetBuilder = useAppSelector(getHasBootstrappedCabinetBuilder);
  const selectedDimensions = useAppSelector(getSelectedDimensions);
  const cabinetEntries = useAppSelector(getCabinetEntries);
  const dimensionsByCabinet = useAppSelector(getDimensionsByCabinet);

  const [sceneConfigs, setSceneConfigs] = useState<NormalizedProductConfigSnapshot[]>([]);
  const productIdsKey = productIds.join("|");

  const refresh = useCallback(async () => {
    console.log(LOG_PREFIX, "fetchSceneConfigs called", {
      productIds,
      presetsCount: productsPresets.length,
      hasBootstrappedCabinetBuilder,
    });

    // When presets exist the bootstrap phase calls addProductId for each preset product first.
    // Only products whose index is >= presetsCount are truly "extra" (added via sidebar).
    // Special cases:
    //  - On the prebuilt page productIds can be empty before PlayCanvas preset ids are synced — keep preset path.
    //  - In Custom Mode, once productIds has been populated by bootstrap and then drops
    //    below presetsCount (user deleted a preset product), fall back to fetching ALL
    //    productIds — the preset-based slicing assumption no longer holds.
    const presetsDesynced =
      productsPresets.length > 0 && productIds.length > 0 && productIds.length < productsPresets.length;
    const idsToFetch = hasBootstrappedCabinetBuilder
      ? productIds
      : presetsDesynced || productsPresets.length === 0
        ? productIds
        : productIds.slice(productsPresets.length);

    if (idsToFetch.length === 0) {
      console.log(
        LOG_PREFIX,
        "fetchSceneConfigs skipped:",
        productsPresets.length > 0 && !hasBootstrappedCabinetBuilder
          ? "using presets, no extra products"
          : "no productIds",
      );
      setSceneConfigs([]);
      return;
    }

    const configs: NormalizedProductConfigSnapshot[] = [];

    for (const id of idsToFetch) {
      try {
        const raw = await getConfig(id);

        if (!raw) continue;

        configs.push(
          normalizeProductConfigSnapshot({
            id,
            raw: raw as Record<string, unknown>,
            recordedDimensions: resolveCabinetDimensions(cabinetEntries, dimensionsByCabinet, id),
          }),
        );
      } catch (err) {
        console.warn(LOG_PREFIX, "Failed to get config for product", id, err);
      }
    }

    setSceneConfigs(configs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productIdsKey,
    productsPresets.length,
    hasBootstrappedCabinetBuilder,
    selectedDimensions.width,
    selectedDimensions.height,
    selectedDimensions.depth,
    cabinetEntries,
    dimensionsByCabinet,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sceneConfigs, refresh };
};
