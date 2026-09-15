import { useContext, useMemo } from "react";

import { ActiveCollectionContext } from "@/entities/collection";
import { createSkuBuilders, resolveSkuProfile, type SkuBuilders } from "@/shared/lib/sku";

/**
 * SKU builders of the active collection.
 *
 * The profile follows the loaded collection: until it is ready, and for a collection with
 * no SKU profile, the builders build nothing and `status`/`reason` say why.
 */
export const useSkuBuilders = (): SkuBuilders => {
  const collection = useContext(ActiveCollectionContext);
  const collectionId = collection?.status === "ready" ? collection.data.id : null;
  const cabinetSkuMappings = collection?.status === "ready" ? collection.data.catalog.cabinetSkuMappings : undefined;

  return useMemo(
    () => createSkuBuilders(resolveSkuProfile(collectionId ? { id: collectionId, cabinetSkuMappings } : null)),
    [cabinetSkuMappings, collectionId],
  );
};
