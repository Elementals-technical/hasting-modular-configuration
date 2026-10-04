import { CUSTOMIZATION_FLOW_IDS, type CustomizationFlowId, type CustomizationSchema } from "@/entities/collection";

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

  const steps = flow.steps.flatMap((ref) => {
    const definition = schema.steps[ref.stepId];
    return definition && definition.enabled !== false ? [toNavigationStep(schema, ref.stepId, ref.path)] : [];
  });

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
    isSummary: currentStep?.kind === "summary",
  };
};

export const toRelativePath = (path: string): string => path.replace(/^\//, "");

const firstSegment = (path: string): string => toRelativePath(path).split("/")[0];

export const resolveFlowForPath = (schema: CustomizationSchema, pathname: string): CustomizationFlowId => {
  const stepsOf = (flowId: CustomizationFlowId) => schema.flows[flowId].steps;
  const ownsPath = (flowId: CustomizationFlowId) => stepsOf(flowId).some((ref) => matchesPath(pathname, ref.path));
  const sharesSegment = (flowId: CustomizationFlowId) =>
    stepsOf(flowId).some((ref) => firstSegment(ref.path) === firstSegment(pathname));

  return CUSTOMIZATION_FLOW_IDS.find(ownsPath) ?? CUSTOMIZATION_FLOW_IDS.find(sharesSegment) ?? "prebuilt";
};

export const resolveEntryStep = (schema: CustomizationSchema, flowId: CustomizationFlowId): NavigationStep | null => {
  const flow = schema.flows[flowId];
  const ref = flow.steps.find((step) => step.stepId === flow.entryStepId);

  if (!ref || !schema.steps[flow.entryStepId]) return null;

  return toNavigationStep(schema, flow.entryStepId, ref.path);
};
