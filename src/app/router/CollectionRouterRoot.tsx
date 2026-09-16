import { Outlet } from "react-router-dom";

import { ActiveCollectionProvider, CollectionReadinessGate } from "@/entities/collection";
import { CollectionStateBridge } from "@/entities/configuration";

export const CollectionRouterRoot = () => (
  <ActiveCollectionProvider>
    {/* Publishes the loaded collection into the store for reducers and non-React code. */}
    <CollectionStateBridge />
    <CollectionReadinessGate>
      <Outlet />
    </CollectionReadinessGate>
  </ActiveCollectionProvider>
);
