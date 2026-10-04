import type { CollectionRegistry } from "../model/schemas";
import {
  resolveCollection,
  type CollectionResolution,
  type SavedCollectionInput,
} from "./resolveCollection";

export type ResolveRestoredCollectionInput = {
  registry: CollectionRegistry;
  urlCollectionId: string | null;
  savedCollection: SavedCollectionInput;
};

export const resolveRestoredCollection = ({
  registry,
  urlCollectionId,
  savedCollection,
}: ResolveRestoredCollectionInput): CollectionResolution =>
  resolveCollection({ registry, urlCollectionId, savedCollection });
