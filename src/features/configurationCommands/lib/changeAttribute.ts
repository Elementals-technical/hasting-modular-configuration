import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import { getCabinetEntries, resolveStableKey, setExplicitUserChoice } from "@/entities/configuration";
import type { ConfigurationRuntimePort } from "@/entities/configuration";

import { applyPlan } from "./applyPlan";
import { evaluateChange, toStoppedResult } from "./evaluateChange";
import type { AttributeChange, ChangeResult } from "../model/types";

/**
 * The single entry point for changing a configuration value.
 *
 * Flow: validate against the active profile -> build the agreed set -> ask for
 * confirmation when the profile declares it -> hand the set to the runtime -> record
 * what actually happened. A confirmed preview goes through confirmAttributeChange.
 * Replacing the direct `setConfig` calls that pages still make is C06.
 */

export type ChangeAttributeDeps = {
  getState: () => RootState;
  dispatch: (action: UnknownAction) => unknown;
  runtime: ConfigurationRuntimePort;
  /** Flow the change is made in; some attributes reach different products in each. */
  flow: RuntimeFlow;
  /** Configurator sections of the active collection; a colour is recorded without its material when absent. */
  configurator?: ConfiguratorGroupCatalog | null;
};

export const changeAttribute = async (
  change: AttributeChange,
  { getState, dispatch, runtime, flow, configurator }: ChangeAttributeDeps,
): Promise<ChangeResult> => {
  const state = getState();
  const evaluation = evaluateChange(change, state, configurator);

  if (evaluation.kind !== "planned") return toStoppedResult(evaluation);

  // Preview: nothing is written and nothing is sent until the user confirms.
  if (evaluation.confirmation.length > 0) {
    return {
      status: "confirmation-required",
      preview: { change, plan: evaluation.plan, reasons: evaluation.confirmation },
      replaced: false,
    };
  }

  const result = await applyPlan(evaluation.plan, {
    state,
    dispatch,
    runtime,
    flow,
    collectionId: evaluation.collectionId,
    configurator,
  });
  recordAcceptedUserChoice(change, result, dispatch);
  return result;
};

/** Exported for tests that need the same runtime-id lookup as the command service. */
export const createRuntimeIdResolver = (state: RootState) => (cabinetId: string) =>
  resolveStableKey(getCabinetEntries(state), cabinetId);

/** Called before the enclosing UI history step completes, including accepted no-ops. */
export const recordAcceptedUserChoice = (
  change: AttributeChange,
  result: ChangeResult,
  dispatch: ChangeAttributeDeps["dispatch"],
): void => {
  if (!change.userInitiated || result.status !== "applied") return;
  if (change.scope === "drawer" || (change.scope === "cabinet" && change.onlyThisCabinet) || (change.scope === "basin" && change.sinkBaseId)) return;
  dispatch(setExplicitUserChoice({ attributeId: change.attributeId, chosen: true }));
};
