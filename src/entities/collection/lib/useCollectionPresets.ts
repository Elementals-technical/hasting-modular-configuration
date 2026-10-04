import { useMemo } from "react";

import { useActiveCollection } from "../ui/activeCollectionContext";
import type { CollectionPreset } from "../model/schemas";

export const useCollectionPresets = (): CollectionPreset[] => {
  const presets = useActiveCollection((collection) => collection.catalog.presets);

  return useMemo(() => presets ?? [], [presets]);
};
