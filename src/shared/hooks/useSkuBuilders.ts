import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import { createSkuBuilders, resolveSkuProfile, type SkuBuilders } from "@/shared/lib/sku";

/** SKU builders derived from the ready active collection's SKU mappings or its own SKU profile. */
export const useSkuBuilders = (): SkuBuilders => {
  const collection = useActiveCollection();
  const collectionId = collection.id;
  const cabinetSkuMappings = collection.catalog.cabinetSkuMappings;
  const skuProfile = collection.catalog.skuProfile;

  return useMemo(
    () => createSkuBuilders(resolveSkuProfile({ id: collectionId, cabinetSkuMappings, skuProfile })),
    [cabinetSkuMappings, collectionId, skuProfile],
  );
};
