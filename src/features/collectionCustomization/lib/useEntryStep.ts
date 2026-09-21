import { useActiveCollection, type CustomizationFlowId } from "@/entities/collection";

import type { NavigationStep } from "../model/types";
import { resolveEntryStep } from "./computeNavigation";

export const useEntryStep = (flowId: CustomizationFlowId): NavigationStep | null => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);

  return schema ? resolveEntryStep(schema, flowId) : null;
};
