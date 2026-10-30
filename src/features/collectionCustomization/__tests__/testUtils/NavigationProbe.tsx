import type { CustomizationFlowId } from "@/entities/collection";

import { useCollectionNavigation } from "../../lib/useCollectionNavigation";

export const NavigationProbe = ({ flow }: { flow?: CustomizationFlowId }) => {
  const navigation = useCollectionNavigation(flow);

  if (!navigation) return <output data-testid="navigation">null</output>;

  return (
    <output data-testid="navigation">
      {JSON.stringify({
        flowId: navigation.flowId,
        steps: navigation.steps.map((step) => ({ stepId: step.stepId, label: step.label, path: step.path })),
        currentStepId: navigation.currentStep?.stepId ?? null,
        previousStepId: navigation.previousStep?.stepId ?? null,
        nextStepId: navigation.nextStep?.stepId ?? null,
      })}
    </output>
  );
};
