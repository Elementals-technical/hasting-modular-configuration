import { useLocation } from "react-router-dom";

import { useActiveCollection, type CustomizationFlowId } from "@/entities/collection";

import type { NavigationResult } from "../model/types";
import { computeNavigation } from "./computeNavigation";

export const useCollectionNavigation = (flowId: CustomizationFlowId): NavigationResult | null => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);
  const { pathname } = useLocation();

  if (!schema) return null;

  return computeNavigation(schema, flowId, pathname);
};
