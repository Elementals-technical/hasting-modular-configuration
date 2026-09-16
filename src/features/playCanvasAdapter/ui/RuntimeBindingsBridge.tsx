import { useEffect } from "react";

import { useActiveCollection } from "@/entities/collection";

import { replaceLoadedRuntimeBindings } from "../lib/runtimeBindingsCache";

/**
 * Publishes the active collection's already validated runtime bindings to scene services
 * that cannot read React context. It never constructs a collection URL or fetches data.
 */
export const RuntimeBindingsBridge = () => {
  const collection = useActiveCollection();
  const data = collection.status === "ready" ? collection.data : null;

  useEffect(() => {
    replaceLoadedRuntimeBindings(data?.id ?? null, data?.catalog.runtimeBindings ?? null);
    return () => replaceLoadedRuntimeBindings(null, null);
  }, [data]);

  return null;
};
