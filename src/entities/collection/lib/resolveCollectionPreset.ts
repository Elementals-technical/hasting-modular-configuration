import type { ProductModel } from "@/entities/product/types";

import { COLLECTIONS, DEFAULT_COLLECTION_SLUG } from "../collectionCatalog";
import type { CollectionConfig, CollectionPreset } from "../types";

export interface ResolvePresetArgs {
  /** `?collection=` value, e.g. "urban-standard". */
  collection?: string | null;
  /** `?preset=` value — a preset slug, or a legacy numeric id as a string. */
  preset?: string | null;
}

type CollectionRegistry = Record<string, CollectionConfig>;

const isLegacyNumericId = (value: string) => /^\d+$/.test(value.trim());

/**
 * Resolve a URL preset reference to a `CollectionPreset`.
 *
 * Resolution order:
 *  1. `collection` + `preset` both present -> look up collection by slug, then
 *     preset by slug. Miss on either -> `null`.
 *  2. numeric `preset`, no `collection` -> default collection, match by `legacyId`
 *     (back-compat for legacy `?preset=N` links).
 *  3. non-numeric `preset`, no `collection` -> match default collection by slug.
 *  4. missing `preset` / any miss -> `null`.
 *
 * The catalog is injected (defaulting to the real registry) so tests can pass a
 * lightweight fixture.
 */
export function resolveCollectionPreset(
  args: ResolvePresetArgs,
  catalog: CollectionRegistry = COLLECTIONS,
): CollectionPreset | null {
  const { collection, preset } = args;
  if (!preset) return null;

  // 1. canonical: collection + preset slugs
  if (collection) {
    const config = catalog[collection];
    if (!config) return null;
    return config.presets.find((p) => p.slug === preset) ?? null;
  }

  const defaultConfig = catalog[DEFAULT_COLLECTION_SLUG];
  if (!defaultConfig) return null;

  // 2. legacy numeric id against the default collection
  if (isLegacyNumericId(preset)) {
    const legacyId = Number(preset);
    return defaultConfig.presets.find((p) => p.legacyId === legacyId) ?? null;
  }

  // 3. slug against the default collection
  return defaultConfig.presets.find((p) => p.slug === preset) ?? null;
}

/**
 * Legacy helper: resolve a numeric preset id to its `ProductModel` within the
 * default collection. Kept for future call-site migration; not yet wired into
 * pages.
 */
export function getPresetById(id: number): ProductModel | null {
  return resolveCollectionPreset({ preset: String(id) })?.model ?? null;
}
