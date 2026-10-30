import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useActiveCollection } from "@/entities/collection";

import { resolveFlowForPath } from "./computeNavigation";
import { resolveSummaryEditTargets, type SummaryEditTargets } from "./summaryEditTargets";

const NO_TARGETS: SummaryEditTargets = { cabinetMenu: [], pathBySectionId: {} };

/** Where the Summary's Edit buttons lead, in the flow the Summary is open in; nowhere without a ui.json. */
export const useSummaryEditTargets = (): SummaryEditTargets => {
  const schema = useActiveCollection((collection) => collection.catalog.customization);
  const { pathname } = useLocation();

  return useMemo(
    () => (schema ? resolveSummaryEditTargets(schema, resolveFlowForPath(schema, pathname)) : NO_TARGETS),
    [schema, pathname],
  );
};
