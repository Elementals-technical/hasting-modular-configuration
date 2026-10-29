import { useLocation } from "react-router-dom";

import { useActiveCollection, type CustomizationFlowId, type CustomizationScreenId } from "@/entities/collection";

import { resolveFlowForPath } from "./computeNavigation";
import { resolveScreenTarget, type CustomizationTarget } from "./resolveAttributeTarget";

/** The step a screen of its own renders, e.g. the accessories page, in a flow (the current one if omitted). */
export const useScreenTarget = (
  screen: CustomizationScreenId,
  flowId?: CustomizationFlowId,
): CustomizationTarget | null => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);
  const { pathname } = useLocation();

  return schema ? resolveScreenTarget(schema, flowId ?? resolveFlowForPath(schema, pathname), screen) : null;
};
