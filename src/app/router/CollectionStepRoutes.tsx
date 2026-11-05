import { useMemo } from "react";
import { useLocation, useRoutes } from "react-router-dom";

import { useActiveCollection } from "@/entities/collection";
import { buildStepRoutes, resolveFlowForPath } from "@/features/collectionCustomization";

import { ColdOpenEntryGuard } from "./ColdOpenEntryGuard";
import { FlowEntryRedirect } from "./FlowEntryRedirect";
import { stepScreens } from "./stepScreens";

export const CollectionStepRoutes = () => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);
  const { pathname } = useLocation();
  const stepRoutes = useMemo(() => (schema ? buildStepRoutes(schema, stepScreens) : []), [schema]);
  const flow = schema ? resolveFlowForPath(schema, pathname) : null;
  const unknownPathRoute = flow ? [{ path: "*", element: <FlowEntryRedirect flow={flow} /> }] : [];

  const routes = useRoutes([
    ...stepRoutes,
    { path: "prebuilt", element: <FlowEntryRedirect flow="prebuilt" /> },
    { path: "custom", element: <FlowEntryRedirect flow="custom" /> },
    ...unknownPathRoute,
  ]);

  return flow ? <ColdOpenEntryGuard flow={flow}>{routes}</ColdOpenEntryGuard> : routes;
};
