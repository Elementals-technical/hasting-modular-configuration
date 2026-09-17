import { screen } from "@testing-library/react";

export type ProbedNavigation = {
  steps: { stepId: string; label: string; path: string }[];
  currentStepId: string | null;
  previousStepId: string | null;
  nextStepId: string | null;
};

export const readNavigation = (): ProbedNavigation =>
  JSON.parse(screen.getByTestId("navigation").textContent ?? "null");
