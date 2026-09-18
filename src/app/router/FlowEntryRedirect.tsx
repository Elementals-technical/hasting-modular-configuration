import { Navigate, useLocation } from "react-router-dom";

import type { CustomizationFlowId } from "@/entities/collection";
import { useEntryStep, withPreservedCollectionId } from "@/features/collectionCustomization";

const FALLBACK_PATH: Record<CustomizationFlowId, string> = {
  prebuilt: "/prebuilt/model",
  custom: "/custom/cabinet-builder",
};

export const FlowEntryRedirect = ({ flow }: { flow: CustomizationFlowId }) => {
  const entry = useEntryStep(flow);
  const location = useLocation();

  return <Navigate to={withPreservedCollectionId(entry?.path ?? FALLBACK_PATH[flow], location.search)} replace />;
};
