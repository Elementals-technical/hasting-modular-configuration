import { Outlet } from "react-router-dom";

import { ActiveCollectionProvider, CollectionReadinessGate } from "@/entities/collection";
import { CollectionStateBridge } from "@/entities/configuration";
import { ReasonTextProvider } from "@/features/collectionCustomization";

export const CollectionRouterRoot = () => (
  <ActiveCollectionProvider>
    {/* Publishes the loaded collection into the store for reducers and non-React code. */}
    <CollectionStateBridge />
    <CollectionReadinessGate>
      {/* One place where a reason code becomes the text the user reads. */}
      <ReasonTextProvider>
        <Outlet />
      </ReasonTextProvider>
    </CollectionReadinessGate>
  </ActiveCollectionProvider>
);
