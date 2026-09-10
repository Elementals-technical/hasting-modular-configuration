import type { UnknownAction } from "@reduxjs/toolkit";

import { setAttributeValue } from "@/entities/configuration";
import {
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  setPlacedCabinetStyle,
  setSelectedDimensions,
  setSelectedProductConfig,
} from "@/entities/product/model/store/slice";

import type { PlannedChange } from "../model/types";

/**
 * Writes an applied change into state.
 *
 * Attributes that still live in the typed product slice have an explicit committer.
 * Everything else falls through to the scoped map in the configuration slice — which is
 * what lets a newly declared attribute survive without a reducer field of its own
 * (TESTING §2, proof 3).
 */

export type CommitContext = {
  /** Current per-product config, so a partial patch does not drop sibling values. */
  selectedProductConfig: Record<string, unknown> | null;
  /** Stable key -> runtime id, for state that is still keyed by runtime id. */
  resolveRuntimeId: (cabinetId: string) => string | null;
};

type Committer = (change: PlannedChange, context: CommitContext) => UnknownAction[];

const COMMITTERS: Record<string, Committer> = {
  Handle: (change, context) => [
    setSelectedProductConfig({ ...(context.selectedProductConfig ?? {}), Handle: String(change.value) }),
  ],

  Drawers: (change, context) => {
    if (change.target.scope !== "cabinet") return [];

    const runtimeId = context.resolveRuntimeId(change.target.cabinetId);
    if (!runtimeId) return [];

    return [setPlacedCabinetStyle({ id: runtimeId, value: String(change.value) })];
  },

  Height: (change) =>
    typeof change.value === "number" ? [setSelectedDimensions({ height: change.value })] : [],

  // Clearing the colour also clears its SKU, so the pricing input cannot outlive the value.
  HandleGrooveColor: (change) => [
    setHandleGrooveColor(String(change.value ?? "")),
    ...(String(change.value ?? "") ? [] : [setHandleGrooveColorSku("")]),
  ],
};

/** Actions that record one planned change. Empty when the change cannot be addressed. */
export const commitChange = (change: PlannedChange, context: CommitContext): UnknownAction[] => {
  const committer = COMMITTERS[change.attributeId];

  if (committer) {
    return committer(change, context);
  }

  return [
    setAttributeValue({
      attributeId: change.attributeId,
      target: change.target,
      value: change.value,
    }) as unknown as UnknownAction,
  ];
};

/** Attribute ids that are written into the typed product slice rather than the scoped map. */
export const TYPED_COMMIT_ATTRIBUTE_IDS: readonly string[] = Object.keys(COMMITTERS);
