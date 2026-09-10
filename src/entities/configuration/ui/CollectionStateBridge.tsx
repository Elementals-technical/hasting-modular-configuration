import { useEffect } from "react";

import { useActiveCollection } from "@/entities/collection";
import { setActiveCollectionId } from "@/entities/configuration/model/store/slice";
import { setActiveProfile, setCabinetCatalog } from "@/entities/product/model/store/slice";
import { useAppDispatch } from "@/shared/hooks/store/redux";

/**
 * Copies the active collection into the store.
 *
 * A publishes the collection through React context, but the rules run inside product
 * reducers where hooks are unavailable — `applyRulesToState` is called from a dozen
 * reducers and reads the profile and the cabinet catalog straight off the state. This
 * component is the one place that bridges the two, so nothing else has to know where the
 * collection came from.
 *
 * Renders nothing; it exists only for the effect.
 */
export const CollectionStateBridge = () => {
  const dispatch = useAppDispatch();
  const collection = useActiveCollection();

  const isReady = collection.status === "ready";
  const data = isReady ? collection.data : null;

  useEffect(() => {
    if (!data) return;

    dispatch(setActiveCollectionId(data.id));
    // Both come from the same load, so the rules never see a profile from one
    // collection next to a catalog from another.
    dispatch(setActiveProfile(data.catalog.productProfile ?? null));

    if (data.catalog.cabinets) {
      dispatch(setCabinetCatalog(data.catalog.cabinets));
    }
  }, [data, dispatch]);

  return null;
};
