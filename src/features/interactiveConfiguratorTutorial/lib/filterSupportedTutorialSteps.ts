import type { CustomizationSchema } from "@/entities/collection";
import { computeNavigation, resolveFlowForPath } from "@/features/collectionCustomization";

import type { InteractiveConfiguratorTutorialStep } from "../model/types";

const isDeclaredStepRoute = (schema: CustomizationSchema, route: string): boolean => {
  const [pathname] = route.split("?");

  return computeNavigation(schema, resolveFlowForPath(schema, pathname), pathname).currentStep !== null;
};

export const filterSupportedTutorialSteps = <Step extends InteractiveConfiguratorTutorialStep>(
  steps: readonly Step[],
  schema: CustomizationSchema | null,
): Step[] => steps.filter((step) => !step.route || !schema || isDeclaredStepRoute(schema, step.route));
