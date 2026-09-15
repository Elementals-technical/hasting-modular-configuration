import type { CustomizationSchema } from "@/entities/collection";

import type {
  InSceneQuickEditorNotificationFlow,
  InSceneQuickEditorNotificationResolvedStep,
  InSceneQuickEditorNotificationTransition,
  InSceneQuickEditorNotificationTransitionResult,
  ResolveInSceneQuickEditorNotificationBacktrackArgs,
} from "../model/types";

const resolveStepByPath = (
  schema: CustomizationSchema,
  flow: InSceneQuickEditorNotificationFlow,
  path: string | null,
): InSceneQuickEditorNotificationResolvedStep | null => {
  if (!path) return null;

  const steps = schema.flows[flow].steps;
  const index = steps.findIndex((step) => path.startsWith(step.path));
  if (index === -1) return null;

  const ref = steps[index];
  const definition = schema.steps[ref.stepId];

  return {
    id: ref.stepId,
    label: definition.label,
    path: ref.path,
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
  schema,
}: ResolveInSceneQuickEditorNotificationBacktrackArgs): InSceneQuickEditorNotificationTransitionResult => {
  if (!schema) {
    return { flow, previousStep: null, currentStep: null, transition: "outside-flow" };
  }

  const previousStep = resolveStepByPath(schema, flow, previousPath);
  const currentStep = resolveStepByPath(schema, flow, currentPath);

  return {
    flow,
    previousStep,
    currentStep,
    transition: resolveTransition(previousStep, currentStep),
  };
};
