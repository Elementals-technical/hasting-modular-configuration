import { CollectionDataError, toCollectionError, type CollectionError } from "../model/errors";
import type { CollectionRegistry } from "../model/schemas";

export const LEGACY_COLLECTION_ID = "urban-standard-height";

export type SavedCollectionInput = {
  collectionId?: string | null;
};

export type CollectionResolution =
  | {
      ok: true;
      collectionId: string;
      entry: CollectionRegistry["collections"][number];
      source: "saved" | "legacy-saved" | "url" | "default";
    }
  | { ok: false; error: CollectionError };

export type ResolveCollectionInput = {
  registry: CollectionRegistry;
  urlCollectionId: string | null;
  savedCollection?: SavedCollectionInput;
};

const resolveRegistered = (
  registry: CollectionRegistry,
  collectionId: string,
  source: Extract<CollectionResolution, { ok: true }>["source"],
): CollectionResolution => {
  if (!collectionId.trim()) {
    return {
      ok: false,
      error: toCollectionError(new CollectionDataError("invalid-collection-id", "Collection identity cannot be empty")),
    };
  }

  const entry = registry.collections.find(({ id }) => id === collectionId);
  if (!entry) {
    return {
      ok: false,
      error: toCollectionError(new CollectionDataError("unknown-collection", `Unknown collection: ${collectionId}`)),
    };
  }
  return { ok: true, collectionId, entry, source };
};

export const resolveCollection = ({
  registry,
  urlCollectionId,
  savedCollection,
}: ResolveCollectionInput): CollectionResolution => {
  if (savedCollection !== undefined) {
    if (savedCollection.collectionId === undefined) {
      return resolveRegistered(registry, LEGACY_COLLECTION_ID, "legacy-saved");
    }
    if (savedCollection.collectionId === null) {
      return {
        ok: false,
        error: toCollectionError(
          new CollectionDataError("invalid-collection-id", "Saved collection identity cannot be null"),
        ),
      };
    }
    return resolveRegistered(registry, savedCollection.collectionId, "saved");
  }

  if (urlCollectionId !== null) return resolveRegistered(registry, urlCollectionId, "url");
  return resolveRegistered(registry, registry.defaultCollectionId, "default");
};
