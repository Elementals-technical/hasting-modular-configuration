import { useEffect } from "react";

import { useActiveCollectionState } from "@/entities/collection";
import { setActiveCollectionId, setActiveRuntimeBindings } from "@/entities/configuration/model/store/slice";
import { replaceCollectionData } from "@/entities/product/model/store/slice";
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
  const collection = useActiveCollectionState();

  const isReady = collection.status === "ready";
  const data = isReady ? collection.data : null;

  useEffect(
    () => () => {
      dispatch(setActiveCollectionId(null));
      dispatch(setActiveRuntimeBindings(null));
      dispatch(replaceCollectionData({ profile: null, cabinetCatalog: null }));
    },
    [dispatch],
  );

  useEffect(() => {
    if (!data) {
      dispatch(setActiveCollectionId(null));
      dispatch(setActiveRuntimeBindings(null));
      dispatch(replaceCollectionData({ profile: null, cabinetCatalog: null }));
      return;
    }

    dispatch(setActiveCollectionId(data.id));
    dispatch(setActiveRuntimeBindings(data.catalog.runtimeBindings ?? null));
    dispatch(
      replaceCollectionData({
        profile: data.catalog.productProfile ?? null,
        cabinetCatalog: data.catalog.cabinets ?? null,
      }),
    );
  }, [data, dispatch]);

  return null;
};
