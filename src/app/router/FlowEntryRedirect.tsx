import { Navigate, useLocation } from "react-router-dom";

import type { CustomizationFlowId } from "@/entities/collection";
import { useEntryStep, withPreservedEntrySearch } from "@/features/collectionCustomization";

const FALLBACK_PATH: Record<CustomizationFlowId, string> = {
  prebuilt: "/prebuilt/model",
  custom: "/custom/cabinet-builder",
};

export const FlowEntryRedirect = ({ flow }: { flow: CustomizationFlowId }) => {
  const entry = useEntryStep(flow);
  const location = useLocation();

  return <Navigate to={withPreservedEntrySearch(entry?.path ?? FALLBACK_PATH[flow], location.search)} replace />;
};
