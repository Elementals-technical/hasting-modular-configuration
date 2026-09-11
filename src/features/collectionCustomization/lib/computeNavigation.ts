import type { CustomizationFlowId, CustomizationSchema } from "@/entities/collection";

import type { NavigationResult, NavigationStep } from "../model/types";

const DEFAULT_HEADER_PREFIX = "Select";

const buildHeaderLabel = (label: string, headerPrefix: string | null | undefined): string =>
  headerPrefix === null ? label : `${headerPrefix ?? DEFAULT_HEADER_PREFIX} ${label}`;

const matchesPath = (pathname: string, stepPath: string): boolean =>
  pathname === stepPath || pathname.startsWith(`${stepPath}/`);

const toNavigationStep = (schema: CustomizationSchema, stepId: string, path: string): NavigationStep => {
  const definition = schema.steps[stepId];

  return {
    stepId,
    path,
    label: definition.label,
    headerLabel: buildHeaderLabel(definition.label, definition.headerPrefix),
    kind: definition.kind,
  };
};

export const computeNavigation = (
  schema: CustomizationSchema,
  flowId: CustomizationFlowId,
  pathname: string,
): NavigationResult => {
  const flow = schema.flows[flowId];

  const steps = flow.steps
    .filter((ref) => schema.steps[ref.stepId])
    .map((ref) => toNavigationStep(schema, ref.stepId, ref.path));

  const matches = steps.filter((step) => matchesPath(pathname, step.path));
  const currentStep = matches.length
    ? matches.reduce((longest, step) => (step.path.length > longest.path.length ? step : longest))
    : null;

  const currentIndex = currentStep ? steps.findIndex((step) => step.stepId === currentStep.stepId) : -1;

  return {
    flowId,
    steps,
    currentStep,
    previousStep: currentIndex > 0 ? steps[currentIndex - 1] : null,
    nextStep: currentIndex >= 0 && currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null,
    summaryStep: steps.find((step) => step.kind === "summary") ?? null,
  };
};

export const resolveEntryStep = (schema: CustomizationSchema, flowId: CustomizationFlowId): NavigationStep | null => {
  const flow = schema.flows[flowId];
  const ref = flow.steps.find((step) => step.stepId === flow.entryStepId);

  if (!ref || !schema.steps[flow.entryStepId]) return null;

  return toNavigationStep(schema, flow.entryStepId, ref.path);
};
