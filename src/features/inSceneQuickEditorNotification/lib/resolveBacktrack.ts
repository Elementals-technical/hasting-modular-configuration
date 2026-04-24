import { CUSTOM_STEPS, PREBUILT_STEPS } from "@/shared/config/steps";

import type {
  InSceneQuickEditorNotificationFlow,
  InSceneQuickEditorNotificationResolvedStep,
  InSceneQuickEditorNotificationStep,
  InSceneQuickEditorNotificationTransition,
  InSceneQuickEditorNotificationTransitionResult,
  ResolveInSceneQuickEditorNotificationBacktrackArgs,
} from "../model/types";

const FLOW_STEP_MAP: Record<InSceneQuickEditorNotificationFlow, readonly InSceneQuickEditorNotificationStep[]> = {
  custom: CUSTOM_STEPS,
  prebuilt: PREBUILT_STEPS,
};

const resolveStepByPath = (
  steps: readonly InSceneQuickEditorNotificationStep[],
  path: string | null,
): InSceneQuickEditorNotificationResolvedStep | null => {
  if (!path) return null;

  const index = steps.findIndex((step) => path.startsWith(step.path));
  if (index === -1) return null;

  return {
    ...steps[index],
    index,
  };
};

const resolveTransition = (
  previousStep: InSceneQuickEditorNotificationResolvedStep | null,
  currentStep: InSceneQuickEditorNotificationResolvedStep | null,
): InSceneQuickEditorNotificationTransition => {
  if (!previousStep || !currentStep) return "outside-flow";
  if (previousStep.index === currentStep.index) return "none";
  if (previousStep.index > currentStep.index) return "backtrack";
  return "forward";
};

export const resolveInSceneQuickEditorNotificationBacktrack = ({
  flow,
  currentPath,
  previousPath,
}: ResolveInSceneQuickEditorNotificationBacktrackArgs): InSceneQuickEditorNotificationTransitionResult => {
  const steps = FLOW_STEP_MAP[flow];
  const previousStep = resolveStepByPath(steps, previousPath);
  const currentStep = resolveStepByPath(steps, currentPath);

  return {
    flow,
    previousStep,
    currentStep,
    transition: resolveTransition(previousStep, currentStep),
  };
};
