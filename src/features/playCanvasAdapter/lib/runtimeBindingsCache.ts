import {
  DEFAULT_COLLECTIONS_ROOT_URL,
  defaultFetchJson,
  parseRuntimeBindings,
  resolveCollectionJsonUrl,
  toAbsoluteCollectionUrl,
} from "@/entities/collection";
import type { RuntimeBindingSet } from "@/entities/collection";

/**
 * TODO(A07): temporary loader of runtime-bindings.json.
 *
 * A's collection loader does not expose `catalog.runtimeBindings` yet, and the adapter
 * cannot reach the scene without it. This reads the active collection's table once and
 * keeps it for the port. Delete this file and RuntimeBindingsBridge once A07 lands.
 *
 * The table sits next to the collection manifest, in the folder named after the collection.
 */

type FetchJson = (url: string, signal: AbortSignal) => Promise<unknown>;

const requests = new Map<string, Promise<RuntimeBindingSet | null>>();
const loaded = new Map<string, RuntimeBindingSet>();

const fetchRuntimeBindings = async (
  collectionId: string,
  fetchJson: FetchJson,
  origin: string,
): Promise<RuntimeBindingSet | null> => {
  try {
    const rootUrl = toAbsoluteCollectionUrl(DEFAULT_COLLECTIONS_ROOT_URL, origin);
    const url = resolveCollectionJsonUrl(`${collectionId}/runtime-bindings.json`, rootUrl, rootUrl);
    const result = parseRuntimeBindings(await fetchJson(url, new AbortController().signal));

    if (!result.ok) {
      console.error(`[runtimeBindings] ${collectionId}: invalid runtime-bindings.json`, result.diagnostics);
      return null;
    }

    if (result.bindings.collectionId !== collectionId) {
      console.error(`[runtimeBindings] ${collectionId}: the table belongs to ${result.bindings.collectionId}`);
      return null;
    }

    return result.bindings;
  } catch (error) {
    console.error(`[runtimeBindings] ${collectionId}: failed to load runtime-bindings.json`, error);
    return null;
  }
};

/** Loads a collection's table once; a failed load is retried on the next call. */
export const loadRuntimeBindings = (
  collectionId: string,
  fetchJson: FetchJson = defaultFetchJson,
  origin: string = window.location.origin,
): Promise<RuntimeBindingSet | null> => {
  const pending = requests.get(collectionId);
  if (pending) return pending;

  const request = fetchRuntimeBindings(collectionId, fetchJson, origin).then((bindings) => {
    if (bindings) {
      loaded.set(collectionId, bindings);
    } else {
      requests.delete(collectionId);
    }

    return bindings;
  });

  requests.set(collectionId, request);
  return request;
};

/** The table of a collection, or null while it loads or when it could not be read. */
export const getLoadedRuntimeBindings = (collectionId: string): RuntimeBindingSet | null =>
  loaded.get(collectionId) ?? null;

/** For tests: forget every loaded table. */
export const resetRuntimeBindingsCache = () => {
  requests.clear();
  loaded.clear();
};
