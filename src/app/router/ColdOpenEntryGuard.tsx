import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import type { CustomizationFlowId } from "@/entities/collection";
import { getSelectedProducts } from "@/entities/product/model/store/selectors";
import { useCollectionNavigation, useEntryStep } from "@/features/collectionCustomization";
import { useAppSelector } from "@/shared/hooks/store/redux";

import { FlowEntryRedirect } from "./FlowEntryRedirect";

type ColdOpenEntryGuardProps = {
  flow: CustomizationFlowId;
  children: ReactNode;
};

/**
 * Sends a step past the flow's entry back to the entry when the app opens on it with nothing configured.
 *
 * Only the entry step builds a composition (from a preset or the cabinet builder), so a reload or a
 * pasted link on a later step would show an empty scene at $0.00. The decision is taken once, for the
 * history entry the app was opened on: a Next clicked before the preset lands, or a composition emptied
 * mid-session, stays where it is.
 */
export const ColdOpenEntryGuard = ({ flow, children }: ColdOpenEntryGuardProps) => {
  const location = useLocation();
  const navigation = useCollectionNavigation(flow);
  const entry = useEntryStep(flow);
  const selectedProducts = useAppSelector(getSelectedProducts);

  const [redirectedLocationKey] = useState(() => {
    const currentStep = navigation?.currentStep;
    const isPastEntry = !!currentStep && !!entry && currentStep.stepId !== entry.stepId;

    return isPastEntry && selectedProducts.length === 0 ? location.key : null;
  });

  if (location.key === redirectedLocationKey) return <FlowEntryRedirect flow={flow} />;

  return <>{children}</>;
};
