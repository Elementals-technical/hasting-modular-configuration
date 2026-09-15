import { useLocation } from "react-router-dom";

import { useActiveCollection, type CustomizationFlowId } from "@/entities/collection";

import type { NavigationResult } from "../model/types";
import { computeNavigation } from "./computeNavigation";

export const useCollectionNavigation = (flowId: CustomizationFlowId): NavigationResult | null => {
  const activeCollection = useActiveCollection();
  const { pathname } = useLocation();

  if (activeCollection.status !== "ready") return null;

  const schema = activeCollection.data.catalog.customization;
  if (!schema) return null;

  return computeNavigation(schema, flowId, pathname);
};
