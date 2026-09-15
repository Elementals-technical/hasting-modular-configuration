import { useMemo } from "react";

import { useActiveCollection } from "../ui/activeCollectionContext";
import type { CollectionPreset } from "../model/schemas";

export const useCollectionPresets = (): CollectionPreset[] => {
  const activeCollection = useActiveCollection();

  return useMemo(
    () => (activeCollection.status === "ready" ? (activeCollection.data.catalog.presets ?? []) : []),
    [activeCollection],
  );
};
