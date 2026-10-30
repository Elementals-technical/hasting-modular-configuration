import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { getActiveCollectionId, getCabinetByStableKey } from "@/entities/configuration";
import type { ConfigurationRuntimePort } from "@/entities/configuration";

import { applyPlan } from "./applyPlan";
import type { ChangeErrorCode, ChangeResult, DimensionChange } from "../model/types";
import type { RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";

export type ChangeDimensionDeps = {
  getState: () => RootState;
  dispatch: (action: UnknownAction) => unknown;
  runtime: ConfigurationRuntimePort;
  flow: RuntimeFlow;
  configurator?: ConfiguratorGroupCatalog | null;
};

const error = (code: ChangeErrorCode, message: string): ChangeResult => ({ status: "error", code, message });

/**
 * Applies a dimension without pretending dimensions are collection option catalogs.
 * Product-specific eligibility remains the responsibility of the caller's existing
 * countertop/dimension rules; this boundary validates only command safety.
 */
export const changeDimension = async (
  change: DimensionChange,
  { getState, dispatch, runtime, flow, configurator }: ChangeDimensionDeps,
): Promise<ChangeResult> => {
  if (!Number.isFinite(change.value)) return error("runtime-failed", "dimension must be a finite number");

  const state = getState();
  const collectionId = getActiveCollectionId(state);
  if (!collectionId) return error("no-active-profile", "no active collection");

  if (change.attributeId === "Width" && !getCabinetByStableKey(state, change.cabinetId)) {
    return error("unknown-target", `unknown cabinet "${change.cabinetId}"`);
  }

  const target =
    change.attributeId === "Width"
      ? ({ scope: "cabinet", cabinetId: change.cabinetId } as const)
      : ({ scope: "global" } as const);

  return applyPlan(
    [{ attributeId: change.attributeId, target, value: change.value, origin: "requested" }],
    { state, dispatch, runtime, flow, collectionId, configurator },
  );
};
