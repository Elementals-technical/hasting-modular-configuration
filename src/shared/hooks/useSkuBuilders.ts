import { useMemo } from "react";

import { useActiveCollection } from "@/entities/collection";
import { createSkuBuilders, resolveSkuProfile, type SkuBuilders } from "@/shared/lib/sku";

/** SKU builders derived from the ready active collection's optional SKU mappings. */
export const useSkuBuilders = (): SkuBuilders => {
  const collection = useActiveCollection();
  const collectionId = collection.id;
  const cabinetSkuMappings = collection.catalog.cabinetSkuMappings;

  return useMemo(
    () => createSkuBuilders(resolveSkuProfile({ id: collectionId, cabinetSkuMappings })),
    [cabinetSkuMappings, collectionId],
  );
};
