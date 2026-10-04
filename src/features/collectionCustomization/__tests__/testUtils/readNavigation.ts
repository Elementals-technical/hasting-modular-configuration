import { screen } from "@testing-library/react";

import type { CustomizationFlowId } from "@/entities/collection";

type ProbedNavigation = {
  flowId: CustomizationFlowId;
  steps: { stepId: string; label: string; path: string }[];
  currentStepId: string | null;
  previousStepId: string | null;
  nextStepId: string | null;
};

export const readNavigation = (): ProbedNavigation =>
  JSON.parse(screen.getByTestId("navigation").textContent ?? "null");
