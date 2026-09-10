import { Outlet } from "react-router-dom";

import { ActiveCollectionProvider } from "@/entities/collection";

export const CollectionRouterRoot = () => (
  <ActiveCollectionProvider>
    <Outlet />
  </ActiveCollectionProvider>
);
