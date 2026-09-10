import type { ZodType } from "zod";

import { CollectionDataError } from "../model/errors";
import {
  collectionManifestSchema,
  collectionRegistrySchema,
  type CollectionManifest,
  type CollectionRegistry,
} from "../model/schemas";
import { resolveCollectionJsonUrl } from "./paths";

const parseOrThrow = <T>(schema: ZodType<T>, input: unknown, code: "invalid-registry" | "invalid-manifest", name: string): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new CollectionDataError(code, `${name} failed validation: ${result.error.message}`, {
      cause: result.error,
    });
  }
  return result.data;
};

export const validateCollectionRegistry = (
  input: unknown,
  registryUrl: string,
  collectionsRootUrl: string,
): CollectionRegistry => {
  const registry = parseOrThrow(collectionRegistrySchema, input, "invalid-registry", "Collection registry");
  const ids = registry.collections.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new CollectionDataError("invalid-registry", "Collection registry contains duplicate collection IDs");
  }
  if (!ids.includes(registry.defaultCollectionId)) {
    throw new CollectionDataError("invalid-registry", "Collection registry default is not registered");
  }

  registry.collections.forEach(({ manifest }) => {
    resolveCollectionJsonUrl(manifest, registryUrl, collectionsRootUrl);
  });
  return registry;
};

export const validateCollectionManifest = (
  input: unknown,
  expectedCollectionId: string,
  manifestUrl: string,
  collectionsRootUrl: string,
): CollectionManifest => {
  const manifest = parseOrThrow(collectionManifestSchema, input, "invalid-manifest", "Collection manifest");
  if (manifest.id !== expectedCollectionId) {
    throw new CollectionDataError(
      "invalid-manifest",
      `Collection manifest identity ${manifest.id} does not match registry identity ${expectedCollectionId}`,
    );
  }

  Object.values(manifest.local ?? {}).forEach((reference) => {
    if (reference) resolveCollectionJsonUrl(reference, manifestUrl, collectionsRootUrl);
  });
  return manifest;
};
