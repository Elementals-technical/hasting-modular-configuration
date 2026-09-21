import { useMemo } from "react";
import { useLocation, useRoutes } from "react-router-dom";

import { useActiveCollection } from "@/entities/collection";
import { buildStepRoutes, resolveFlowForPath } from "@/features/collectionCustomization";

import { FlowEntryRedirect } from "./FlowEntryRedirect";
import { stepScreens } from "./stepScreens";

export const CollectionStepRoutes = () => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);
  const { pathname } = useLocation();
  const stepRoutes = useMemo(() => (schema ? buildStepRoutes(schema, stepScreens) : []), [schema]);
  const unknownPathRoute = schema
    ? [{ path: "*", element: <FlowEntryRedirect flow={resolveFlowForPath(schema, pathname)} /> }]
    : [];

  return useRoutes([
    ...stepRoutes,
    { path: "prebuilt", element: <FlowEntryRedirect flow="prebuilt" /> },
    { path: "custom", element: <FlowEntryRedirect flow="custom" /> },
    ...unknownPathRoute,
  ]);
};
