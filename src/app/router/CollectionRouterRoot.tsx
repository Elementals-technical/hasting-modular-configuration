import { Outlet } from "react-router-dom";

import { ActiveCollectionProvider, CollectionReadinessGate } from "@/entities/collection";
import { CollectionStateBridge } from "@/entities/configuration";
import { RuntimeBindingsBridge } from "@/features/playCanvasAdapter";

export const CollectionRouterRoot = () => (
  <ActiveCollectionProvider>
    {/* Publishes the loaded collection into the store for reducers and non-React code. */}
    <CollectionStateBridge />
    {/* Publishes the active collection's validated bindings for non-React scene services. */}
    <RuntimeBindingsBridge />
    <CollectionReadinessGate>
      <Outlet />
    </CollectionReadinessGate>
  </ActiveCollectionProvider>
);
