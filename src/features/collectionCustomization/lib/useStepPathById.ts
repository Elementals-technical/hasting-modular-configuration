import { useMemo } from "react";

import type { CustomizationFlowId } from "@/entities/collection";

import type { NavigationStep } from "../model/types";
import { useCollectionNavigation } from "./useCollectionNavigation";

export const buildStepPathById = (steps: NavigationStep[] | undefined): Record<string, string> =>
  Object.fromEntries((steps ?? []).map((step) => [step.stepId, step.path]));

/** Every step's own path, keyed by stepId, for a flow (the current one if omitted). */
export const useStepPathById = (flowId?: CustomizationFlowId): Record<string, string> => {
  const steps = useCollectionNavigation(flowId)?.steps;
  return useMemo(() => buildStepPathById(steps), [steps]);
};
