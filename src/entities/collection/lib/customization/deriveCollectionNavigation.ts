import { CUSTOMIZATION_FLOW_IDS, type CustomizationSchema } from "../../model/customizationSchema";
import type { CollectionNavigation } from "../../model/schemas";

const compatibilityId = (stepId: string): string =>
  stepId.endsWith("-custom") ? stepId.slice(0, -"-custom".length) : stepId;

export const deriveCollectionNavigation = (schema: CustomizationSchema): CollectionNavigation =>
  Object.fromEntries(
    CUSTOMIZATION_FLOW_IDS.map((flowId) => [
      flowId,
      schema.flows[flowId].steps.map(({ stepId, path }) => {
        const definition = schema.steps[stepId];
        return {
          id: compatibilityId(stepId),
          label: definition.label,
          path,
          ...(definition.headerPrefix !== undefined ? { headerPrefix: definition.headerPrefix } : {}),
        };
      }),
    ]),
  ) as CollectionNavigation;

export const findNavigationMismatch = (
  expected: CollectionNavigation,
  actual: CollectionNavigation,
): string | undefined => {
  for (const flowId of CUSTOMIZATION_FLOW_IDS) {
    if (expected[flowId].length !== actual[flowId].length) return `${flowId}.length`;

    for (const [index, expectedStep] of expected[flowId].entries()) {
      const actualStep = actual[flowId][index];
      if (!actualStep) return `${flowId}[${index}]`;

      for (const property of ["id", "label", "path", "headerPrefix"] as const) {
        if (expectedStep[property] !== actualStep[property]) return `${flowId}[${index}].${property}`;
      }
    }
  }

  return undefined;
};
