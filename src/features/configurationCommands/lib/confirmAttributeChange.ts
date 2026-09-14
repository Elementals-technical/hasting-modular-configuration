import { formatTarget } from "@/entities/configuration";

import { applyPlan } from "./applyPlan";
import type { ChangeAttributeDeps } from "./changeAttribute";
import { evaluateChange, toStoppedResult } from "./evaluateChange";
import type { ChangePreview, ChangeResult, PlannedChange } from "../model/types";

/**
 * Applies a change the user confirmed.
 *
 * The preview is never applied as it was: the change is checked again against the state
 * at the moment of confirmation (CONTRACTS §3). The same set is applied; a set that
 * changed is shown again instead of being applied; a change that became disallowed is
 * blocked. Cancel needs no call — dropping the preview leaves state and scene untouched.
 */

const planEntryKey = ({ attributeId, target, value, origin, reasonCode }: PlannedChange): string =>
  JSON.stringify([attributeId, formatTarget(target), value, origin, reasonCode ?? null]);

const isSamePlan = (a: readonly PlannedChange[], b: readonly PlannedChange[]): boolean =>
  a.length === b.length && a.every((entry, index) => planEntryKey(entry) === planEntryKey(b[index]));

export const confirmAttributeChange = async (
  preview: ChangePreview,
  { getState, dispatch, runtime, flow }: ChangeAttributeDeps,
): Promise<ChangeResult> => {
  const state = getState();
  const evaluation = evaluateChange(preview.change, state);

  if (evaluation.kind !== "planned") return toStoppedResult(evaluation);

  if (!isSamePlan(evaluation.plan, preview.plan)) {
    return {
      status: "confirmation-required",
      preview: { change: preview.change, plan: evaluation.plan, reasons: evaluation.confirmation },
      replaced: true,
    };
  }

  return applyPlan(evaluation.plan, { state, dispatch, runtime, flow, collectionId: evaluation.collectionId });
};
