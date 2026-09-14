import type { RootState } from "@/app/store";
import { normalizeOptionValue } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration";
import { getCabinetCatalog } from "@/entities/product/model/store/selectors";
import type { Selection } from "@/features/configurator-rule-core/cabinetBuilder";

import { buildChangePlan } from "./buildChangePlan";
import { resolveConfirmation } from "./confirmationPolicy";
import { resolveTarget } from "./resolveTarget";
import { validateChange } from "./validateChange";
import type {
  AttributeChange,
  ChangeBlockedReason,
  ChangeErrorCode,
  ChangeResult,
  ConfirmationReason,
  PlannedChange,
} from "../model/types";

/**
 * Everything a change needs decided before anything is applied: validation, the agreed
 * set and whether the user must confirm it. Reads state only; it neither dispatches nor
 * calls the scene, which is what lets a preview and its confirmation share one check.
 */

export type ChangeEvaluation =
  | { kind: "error"; code: ChangeErrorCode; message: string }
  | ({ kind: "blocked" } & ChangeBlockedReason)
  | {
      kind: "planned";
      plan: PlannedChange[];
      /** Empty when the set is applied without asking. */
      confirmation: ConfirmationReason[];
      collectionId: string;
    };

/**
 * State stores the runtime spelling of a value ("1D"); the rule engine works on the
 * canonical option value ("1"). The profile catalog owns that translation, so the
 * mapping is not repeated here.
 */
const toSelection = (state: RootState): Selection => {
  const product = state.rootStateUI.product;
  const config = product.selectedProductConfig;
  const profile = product.activeProfile;

  return {
    cabinetType: product.activeCabinetType,
    width: product.selectedDimensions.width ?? 0,
    depth: product.selectedDimensions.depth ?? 0,
    height: product.selectedDimensions.height ?? 0,
    drawers: normalizeOptionValue(profile, "Drawers", config?.Drawers),
    handle: normalizeOptionValue(profile, "Handle", config?.Handle),
  };
};

export const evaluateChange = (change: AttributeChange, state: RootState): ChangeEvaluation => {
  const profile = getActiveProductProfile(state);
  const cabinets = getCabinetEntries(state);

  // Gates 1-3: attribute known, scope matches, value in catalog.
  const verdict = validateChange(change, profile);

  if (!verdict.ok) {
    return verdict.kind === "error"
      ? { kind: "error", code: verdict.code, message: verdict.message }
      : { kind: "blocked", attributeId: verdict.attributeId, reasonCode: verdict.reasonCode, reason: verdict.reason };
  }

  const targetResult = resolveTarget(change, cabinets);

  if (!targetResult.ok) {
    return { kind: "error", code: "unknown-target", message: targetResult.message };
  }

  // `profile` is non-null here: validateChange returns an error otherwise.
  const activeProfile = profile as NonNullable<typeof profile>;

  // Gate 4 plus the dependent changes.
  const planResult = buildChangePlan({
    attributeId: change.attributeId,
    value: String(change.value ?? ""),
    target: targetResult.target,
    selection: toSelection(state),
    selectedProductIds: state.rootStateUI.product.productIds,
    catalog: getCabinetCatalog(state),
    profile: activeProfile,
    handleGrooveColor: state.rootStateUI.product.productOptions.HandleGrooveColor,
  });

  if (!planResult.ok) {
    return {
      kind: "blocked",
      attributeId: planResult.attributeId,
      reasonCode: planResult.reasonCode,
      reason: planResult.reason,
    };
  }

  return {
    kind: "planned",
    plan: planResult.plan,
    confirmation: resolveConfirmation(change, planResult.plan, activeProfile, cabinets.length),
    collectionId: activeProfile.collectionId,
  };
};

/** The result of a change that stopped before its set was planned. */
export const toStoppedResult = (evaluation: Exclude<ChangeEvaluation, { kind: "planned" }>): ChangeResult =>
  evaluation.kind === "error"
    ? { status: "error", code: evaluation.code, message: evaluation.message }
    : {
        status: "blocked",
        attributeId: evaluation.attributeId,
        reasonCode: evaluation.reasonCode,
        reason: evaluation.reason,
      };
