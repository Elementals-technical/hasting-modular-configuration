import type { CabinetSkuMappings, CollectionSkuProfile } from "@/entities/collection/model/schemas";

import type { SkuProfileResolution } from "./skuProfile";
import { SKU_SERIES_BY_COLLECTION } from "./skuSeries";

export type SkuProfileSource = {
  id: string;
  /** `catalog.cabinetSkuMappings` of the loaded collection. */
  cabinetSkuMappings?: CabinetSkuMappings;
  /** `catalog.skuProfile`: the collection's own SKU words (D04). */
  skuProfile?: CollectionSkuProfile;
};

/** The SKU profile of a collection, or why its SKUs cannot be built. */
export const resolveSkuProfile = (collection: SkuProfileSource | null): SkuProfileResolution => {
  if (!collection) return { status: "unsupported", collectionId: null, reason: "no-collection" };
  if (collection.skuProfile) return { status: "collection", collectionProfile: collection.skuProfile };

  const series = SKU_SERIES_BY_COLLECTION[collection.id];
  if (!series) return { status: "unsupported", collectionId: collection.id, reason: "no-sku-series" };

  if (!collection.cabinetSkuMappings) {
    return { status: "unsupported", collectionId: collection.id, reason: "no-cabinet-mappings" };
  }

  return {
    status: "ready",
    profile: { collectionId: collection.id, series, cabinetMappings: collection.cabinetSkuMappings },
  };
};
