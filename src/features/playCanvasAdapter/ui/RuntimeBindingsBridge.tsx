import { useEffect } from "react";

import { useActiveCollection } from "@/entities/collection";

import { loadRuntimeBindings } from "../lib/runtimeBindingsCache";

/**
 * TODO(A07): loads the active collection's runtime bindings for the scene adapter.
 * Renders nothing. Remove together with runtimeBindingsCache once A's loader exposes them.
 */
export const RuntimeBindingsBridge = () => {
  const collection = useActiveCollection();
  const collectionId = collection.status === "ready" ? collection.data.id : null;

  useEffect(() => {
    if (collectionId) void loadRuntimeBindings(collectionId);
  }, [collectionId]);

  return null;
};
