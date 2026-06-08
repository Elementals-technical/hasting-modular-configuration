import { productMockData } from "@/entities/product/ui/ProductModelsGrid/ProductModelsGrid";

import { DEFAULT_CABINET_COLOR, DEFAULT_COUNTERTOP_COLOR, DEFAULT_SINK_TYPE } from "./defaults";
import { slugFromTitle } from "./lib/slugFromTitle";
import type { CollectionConfig } from "./types";

/**
 * The Urban Standard collection.
 *
 * Built by mapping the existing `productMockData` array rather than re-declaring
 * ~200 entries: each model keeps its numeric id as `legacyId` and gains a derived
 * `slug`. When a second collection is added, introduce another `CollectionConfig`
 * here and register it in `COLLECTIONS`.
 *
 * Several composition variants share the same title (mirroring the `_v2`/`_v3`
 * image naming), so a per-title occurrence counter disambiguates duplicate slugs
 * deterministically: the first occurrence keeps the clean title slug, later ones
 * get a `-2`, `-3`, ... suffix. Titles never carry a numeric suffix themselves,
 * so this cannot collide with a naturally derived slug.
 */
const buildPresets = () => {
  const seen = new Map<string, number>();

  return productMockData.map((model) => {
    const base = slugFromTitle(model.title);
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    return {
      legacyId: model.id,
      slug: occurrence === 1 ? base : `${base}-${occurrence}`,
      model,
    };
  });
};

export const urbanStandardCollection: CollectionConfig = {
  slug: "urban-standard",
  title: "Urban Standard",
  presets: buildPresets(),
  defaults: {
    cabinetColor: DEFAULT_CABINET_COLOR,
    countertopColor: DEFAULT_COUNTERTOP_COLOR,
    sinkType: DEFAULT_SINK_TYPE,
  },
};

/** Registry of all known collections, keyed by slug. */
export const COLLECTIONS: Record<string, CollectionConfig> = {
  [urbanStandardCollection.slug]: urbanStandardCollection,
};

/** Collection used when a URL provides no explicit `?collection=` (legacy links). */
export const DEFAULT_COLLECTION_SLUG = urbanStandardCollection.slug;
