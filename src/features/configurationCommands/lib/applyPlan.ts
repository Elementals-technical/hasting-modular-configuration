import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getActiveProductProfile,
  getCabinetEntries,
  markRuntimeOutOfSync,
  requestSceneStateSync,
} from "@/entities/configuration";
import type { ConfigurationRuntimePort, RuntimeContext } from "@/entities/configuration";

import { commitPlan, type CommitContext } from "./commitChange";
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

/** What the adapter needs to address the scene, read from the state a set is applied to. */
export const buildRuntimeContext = (state: RootState, collectionId: string, flow: RuntimeFlow): RuntimeContext => {
  const cabinets = getCabinetEntries(state);

  return {
    collectionId,
    flow,
    resolveRuntimeId: (cabinetId) => cabinets.find((candidate) => candidate.stableKey === cabinetId)?.runtimeId ?? null,
    cabinetRuntimeIds: cabinets.map((entry) => entry.runtimeId),
  };
};

/** What the committers need to record a set applied to this state. */
export const buildCommitContext = (
  state: RootState,
  context: RuntimeContext,
  configurator: ConfiguratorGroupCatalog | null | undefined,
): CommitContext => ({
  selectedProductConfig: state.rootStateUI.product.selectedProductConfig ?? null,
  resolveRuntimeId: context.resolveRuntimeId,
  profile: getActiveProductProfile(state),
  configurator: configurator ?? null,
  productsPresets: state.rootStateUI.product.productsPresets,
});

export const applyPlan = async (
  plan: PlannedChange[],
  { state, dispatch, runtime, flow, collectionId, configurator }: ApplyPlanDeps,
): Promise<ChangeResult> => {
  const context = buildRuntimeContext(state, collectionId, flow);

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

  // Only what the runtime actually applied is recorded. A change the scene rejected must
  // not end up in state as if it had succeeded.
  for (const action of commitPlan(runtimeResult.applied, buildCommitContext(state, context, configurator))) {
    dispatch(action);
  }

  if (runtimeResult.status === "partial") {
    // The state now mirrors exactly what the scene accepted, but the composition no
    // longer represents the agreed set. Save waits for I's next reader sync, restore,
    // or reload instead of serializing that ambiguous intermediate state.
    dispatch(markRuntimeOutOfSync());
    dispatch(requestSceneStateSync());
    return {
      status: "partial",
      applied: runtimeResult.applied,
      failed: runtimeResult.failed,
      needsSync: true,
    };
  }

  // Do not rely on a page reducer happening to fire after a command. I04 is the
  // authoritative source for order and dimensions, including a dimension command.
  dispatch(requestSceneStateSync());
  return { status: "applied", plan };
};
