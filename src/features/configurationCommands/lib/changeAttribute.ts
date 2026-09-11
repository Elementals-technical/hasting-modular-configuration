import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { normalizeOptionValue } from "@/entities/collection";
import type { RuntimeFlow } from "@/entities/collection";
import { getActiveProductProfile, getCabinetEntries, resolveStableKey } from "@/entities/configuration";
import type { ConfigurationRuntimePort, RuntimeContext } from "@/entities/configuration";
import { getCabinetCatalog } from "@/entities/product/model/store/selectors";
import type { Selection } from "@/features/configurator-rule-core/cabinetBuilder";

import { buildChangePlan } from "./buildChangePlan";
import { commitChange } from "./commitChange";
import { resolveTarget } from "./resolveTarget";
import { validateChange } from "./validateChange";
import type { AttributeChange, ChangeResult } from "../model/types";

/**
 * The single entry point for changing a configuration value.
 *
 * Flow: validate against the active profile -> build the agreed set -> hand it to the
 * runtime -> record what actually happened. Preview/confirm/cancel is not here on
 * purpose; that is C05. Replacing the direct `setConfig` calls that pages still make
 * is C06.
 */

export type ChangeAttributeDeps = {
  getState: () => RootState;
  dispatch: (action: UnknownAction) => unknown;
  runtime: ConfigurationRuntimePort;
  /** Flow the change is made in; some attributes reach different products in each. */
  flow: RuntimeFlow;
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

export const changeAttribute = async (
  change: AttributeChange,
  { getState, dispatch, runtime, flow }: ChangeAttributeDeps,
): Promise<ChangeResult> => {
  const state = getState();
  const profile = getActiveProductProfile(state);
  const cabinets = getCabinetEntries(state);

  // Gates 1-3: attribute known, scope matches, value in catalog.
  const verdict = validateChange(change, profile);

  if (!verdict.ok) {
    return verdict.kind === "error"
      ? { status: "error", code: verdict.code, message: verdict.message }
      : {
          status: "blocked",
          attributeId: verdict.attributeId,
          reasonCode: verdict.reasonCode,
          reason: verdict.reason,
        };
  }

  const targetResult = resolveTarget(change, cabinets);

  if (!targetResult.ok) {
    return { status: "error", code: "unknown-target", message: targetResult.message };
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
      status: "blocked",
      attributeId: planResult.attributeId,
      reasonCode: planResult.reasonCode,
      reason: planResult.reason,
    };
  }

  const resolveRuntimeId = (cabinetId: string): string | null => {
    const entry = cabinets.find((candidate) => candidate.stableKey === cabinetId);
    return entry?.runtimeId ?? null;
  };

  const context: RuntimeContext = {
    collectionId: activeProfile.collectionId,
    flow,
    resolveRuntimeId,
    cabinetRuntimeIds: cabinets.map((entry) => entry.runtimeId),
  };

  const runtimeResult = await runtime.apply(planResult.plan, context);

  // Nothing reached the scene: nothing is recorded.
  switch (runtimeResult.status) {
    case "not-ready":
      return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet." };

    case "unsupported":
      return {
        status: "error",
        code: "runtime-unsupported",
        message: `No scene translation for ${runtimeResult.unsupported.map(({ change }) => change.attributeId).join(", ")}.`,
      };

    case "failed":
      return {
        status: "error",
        code: "runtime-failed",
        message: runtimeResult.failed[0]?.message ?? "The scene did not apply the change.",
      };
  }

  const commitContext = {
    selectedProductConfig: state.rootStateUI.product.selectedProductConfig ?? null,
    resolveRuntimeId,
  };

  // Only what the runtime actually applied is recorded. A change the scene rejected must
  // not end up in state as if it had succeeded.
  for (const applied of runtimeResult.applied) {
    for (const action of commitChange(applied, commitContext)) {
      dispatch(action);
    }
  }

  if (runtimeResult.status === "partial") {
    return {
      status: "partial",
      applied: runtimeResult.applied,
      failed: runtimeResult.failed,
      needsSync: true,
    };
  }

  return { status: "applied", plan: planResult.plan };
};

/** Exported for tests that need the same runtime-id lookup as the command service. */
export const createRuntimeIdResolver = (state: RootState) => (cabinetId: string) =>
  resolveStableKey(getCabinetEntries(state), cabinetId);
