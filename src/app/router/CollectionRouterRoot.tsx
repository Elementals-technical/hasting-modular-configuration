import { Outlet } from "react-router-dom";

import { ActiveCollectionProvider } from "@/entities/collection";
import { CollectionStateBridge } from "@/entities/configuration";
import { RuntimeBindingsBridge } from "@/features/playCanvasAdapter";

export const CollectionRouterRoot = () => (
  <ActiveCollectionProvider>
    {/* Publishes the loaded collection into the store for reducers and non-React code. */}
    <CollectionStateBridge />
    {/* TODO(A07): loads runtime-bindings.json until A's loader provides it. */}
    <RuntimeBindingsBridge />
    <Outlet />
  </ActiveCollectionProvider>
);
