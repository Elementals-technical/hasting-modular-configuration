import { Navigate, useLocation } from "react-router-dom";

import { useActiveCollection, type CustomizationFlowId } from "@/entities/collection";
import { resolveEntryStep, withPreservedCollectionId } from "@/features/collectionCustomization";

const FALLBACK_PATH: Record<CustomizationFlowId, string> = {
  prebuilt: "/prebuilt/model",
  custom: "/custom/cabinet-builder",
};

export const FlowEntryRedirect = ({ flow }: { flow: CustomizationFlowId }) => {
  const activeCollection = useActiveCollection();
  const location = useLocation();

  if (activeCollection.status !== "ready") return null;

  const schema = activeCollection.data.catalog.customization;
  const entry = schema ? resolveEntryStep(schema, flow) : null;

  return <Navigate to={withPreservedCollectionId(entry?.path ?? FALLBACK_PATH[flow], location.search)} replace />;
};
