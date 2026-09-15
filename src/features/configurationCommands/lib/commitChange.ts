import type { UnknownAction } from "@reduxjs/toolkit";

import type { ProductProfile } from "@/entities/collection";
import { selectLegacySpelling } from "@/entities/collection";
import { setAttributeValue } from "@/entities/configuration";
import {
  commitRuleSelection,
  setActiveCountertopThickness,
  setDrawerPanelFluting,
  setGrainDirection,
  setHandleGrooveColor,
  setHandleGrooveColorSku,
  setPlacedCabinetStyle,
  setTowelBarColor,
  setTowelBarOption,
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
  /** Active profile, for the legacy spelling state still stores. */
  profile: ProductProfile | null;
};

type Committer = (change: PlannedChange, context: CommitContext) => UnknownAction[];

const asText = (change: PlannedChange): string => String(change.value ?? "");

const COMMITTERS: Record<string, Committer> = {
  // The command already planned the dependent height and groove reset, so the reducer
  // records the handle without deriving them a second time.
  Handle: (change) => [commitRuleSelection({ handle: String(change.value) })],

  Drawers: (change, context) => {
    if (change.target.scope !== "cabinet") return [];

    const runtimeId = context.resolveRuntimeId(change.target.cabinetId);
    if (!runtimeId) return [];

    return [setPlacedCabinetStyle({ id: runtimeId, value: String(change.value) })];
  },

  Height: (change) => (typeof change.value === "number" ? [commitRuleSelection({ height: change.value })] : []),

  // Clearing the colour also clears its SKU, so the pricing input cannot outlive the value.
  HandleGrooveColor: (change) => [
    setHandleGrooveColor(asText(change)),
    ...(asText(change) ? [] : [setHandleGrooveColorSku("")]),
  ],

  DrawerPanelFluting: (change) => [setDrawerPanelFluting(asText(change))],
  // The book matching listener reacts to this action and drops a value that no longer applies.
  GrainDirection: (change) => [setGrainDirection(asText(change))],
  TowelBarOption: (change) => [setTowelBarOption(asText(change))],
  TowelBarColor: (change) => [setTowelBarColor(asText(change))],
  // Written as the change carries it, so the stored format and the SKU input stay the same.
  Thickness: (change) => [setActiveCountertopThickness(asText(change))],
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

type RuleSelectionCommit = { handle?: string; height?: number; drawers?: string };

/**
 * Actions that record an applied set.
 *
 * Handle, height and drawers go into one commitRuleSelection after the per-cabinet actions,
 * so availability is refreshed once for the whole set and sees the new drawers of every
 * cabinet, rather than once per value against a half-written state.
 */
export const commitPlan = (changes: readonly PlannedChange[], context: CommitContext): UnknownAction[] => {
  const actions: UnknownAction[] = [];
  const ruleSelection: RuleSelectionCommit = {};

  for (const change of changes) {
    switch (change.attributeId) {
      case "Handle":
        ruleSelection.handle = String(change.value);
        break;

      case "Height":
        if (typeof change.value === "number") ruleSelection.height = change.value;
        break;

      case "Drawers":
        actions.push(...commitChange(change, context));
        ruleSelection.drawers = selectLegacySpelling(context.profile, "Drawers", String(change.value));
        break;

      default:
        actions.push(...commitChange(change, context));
    }
  }

  if (Object.keys(ruleSelection).length > 0) {
    actions.push(commitRuleSelection(ruleSelection));
  }

  return actions;
};

/** Attribute ids that are written into the typed product slice rather than the scoped map. */
export const TYPED_COMMIT_ATTRIBUTE_IDS: readonly string[] = Object.keys(COMMITTERS);
