import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { getActiveProductProfile, getCabinetEntries } from "@/entities/configuration";
import type { ConfigurationRuntimePort, RuntimeContext } from "@/entities/configuration";

import { commitPlan } from "./commitChange";
import type { ChangeResult, PlannedChange } from "../model/types";

/**
 * Hands an agreed set to I and records what actually happened.
 *
 * Shared by a change applied at once and a confirmed one, so both treat the scene's
 * answer the same way: an error from I never becomes a success, and only what the scene
 * applied reaches state.
 */

export type ApplyPlanDeps = {
  state: RootState;
  dispatch: (action: UnknownAction) => unknown;
  runtime: ConfigurationRuntimePort;
  flow: RuntimeFlow;
  collectionId: string;
  /** Configurator sections of the active collection, for the material and finish of a colour. */
  configurator?: ConfiguratorGroupCatalog | null;
};

export const applyPlan = async (
  plan: PlannedChange[],
  { state, dispatch, runtime, flow, collectionId, configurator }: ApplyPlanDeps,
): Promise<ChangeResult> => {
  const cabinets = getCabinetEntries(state);

  const resolveRuntimeId = (cabinetId: string): string | null =>
    cabinets.find((candidate) => candidate.stableKey === cabinetId)?.runtimeId ?? null;

  const context: RuntimeContext = {
    collectionId,
    flow,
    resolveRuntimeId,
    cabinetRuntimeIds: cabinets.map((entry) => entry.runtimeId),
  };

  const runtimeResult = await runtime.apply(plan, context);

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
    profile: getActiveProductProfile(state),
    configurator: configurator ?? null,
    productsPresets: state.rootStateUI.product.productsPresets,
  };

  // Only what the runtime actually applied is recorded. A change the scene rejected must
  // not end up in state as if it had succeeded.
  for (const action of commitPlan(runtimeResult.applied, commitContext)) {
    dispatch(action);
  }

  if (runtimeResult.status === "partial") {
    return {
      status: "partial",
      applied: runtimeResult.applied,
      failed: runtimeResult.failed,
      needsSync: true,
    };
  }

  return { status: "applied", plan };
};
