import type { ProductModel } from "@/entities/product/types";

/** Known collection slugs. Add new collections here as they are introduced. */
export type CollectionSlug = "urban-standard";

export interface CollectionPreset {
  /** Stable numeric id from legacy `productMockData` — back-compat for `?preset=N`. */
  legacyId: number;
  /** URL-safe identifier, unique within a collection (used by `?preset=<slug>`). */
  slug: string;
  /** The existing enriched product model, reused as-is (never rewritten by hand). */
  model: ProductModel;
}

export interface CollectionDefaults {
  cabinetColor: string;
  countertopColor: string;
  sinkType: string;
}

export interface CollectionConfig {
  slug: CollectionSlug;
  title: string;
  presets: CollectionPreset[];
  defaults: CollectionDefaults;
}
