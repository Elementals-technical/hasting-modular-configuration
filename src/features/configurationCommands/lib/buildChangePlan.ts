import type { ProductProfile } from "@/entities/collection";
import { hasCapability, selectMessage, selectResetValue } from "@/entities/collection";
import type { ValueTarget } from "@/entities/configuration";
import { applyConfiguratorRules, type Selection } from "@/features/configurator-rule-core/cabinetBuilder";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import type { ChangeBlockedReason, PlannedChange } from "../model/types";

/**
 * Turns a validated request into the full set of changes that must happen together.
 *
 * The set is what I receives: the requested value plus everything the current rules
 * require alongside it — a forced height, a groove colour that no longer applies.
 * Nothing here talks to the scene or the store.
 */

export const REASON_DEPENDENT_HEIGHT = "handle.requiredHeight";
export const REASON_GROOVE_NOT_SUPPORTED = "handle.grooveColorCleared";

export type BuildChangePlanArgs = {
  attributeId: string;
  value: string;
  target: ValueTarget;
  /** Selection as it stands before the change. */
  selection: Selection;
  /** Products currently in the composition, for the supports-height check. */
  selectedProductIds: string[];
  catalog: ConfiguratorCatalog;
  profile: ProductProfile;
  /** Current groove colour, to decide whether clearing it is part of the set. */
  handleGrooveColor: string | null | undefined;
};

export type BuildChangePlanResult =
  | { ok: true; plan: PlannedChange[] }
  | ({ ok: false } & ChangeBlockedReason);

/** Fields of `Selection` that a change can address; anything else needs no rule re-run. */
const SELECTION_FIELD_BY_ATTRIBUTE: Record<string, keyof Selection> = {
  CabinetType: "cabinetType",
  Drawers: "drawers",
  Handle: "handle",
};

const configurationTarget = (): ValueTarget => ({ scope: "global" });

export const buildChangePlan = ({
  attributeId,
  value,
  target,
  selection,
  selectedProductIds,
  catalog,
  profile,
  handleGrooveColor,
}: BuildChangePlanArgs): BuildChangePlanResult => {
  const plan: PlannedChange[] = [{ attributeId, target, value, origin: "requested" }];

  const selectionField = SELECTION_FIELD_BY_ATTRIBUTE[attributeId];

  // Attributes outside the rule engine's selection carry no dependencies in this slice.
  if (!selectionField) {
    return { ok: true, plan };
  }

  const nextSelection: Selection = { ...selection, [selectionField]: value };

  const result = applyConfiguratorRules(
    nextSelection,
    { field: selectionField === "cabinetType" ? "cabinetType" : selectionField, value },
    { selectedProductIds },
    catalog,
    profile,
  );

  // Gate 4: the rules decide whether the requested option is selectable at all.
  const optionState =
    selectionField === "handle"
      ? result.availableOptions.handles.find((option) => option.value === value)
      : selectionField === "drawers"
        ? result.availableOptions.drawers.find((option) => option.value === value)
        : undefined;

  if (optionState && !optionState.enabled) {
    return {
      ok: false,
      attributeId,
      reasonCode: optionState.reason ?? "change.notAvailable",
      reason: optionState.reason ?? selectMessage(profile, "change.notAvailable"),
    };
  }

  // A rule-driven height belongs to the same set: applying the handle without it would
  // leave the scene at a height the rules no longer allow.
  const nextHeight = result.nextSelection.height;

  if (typeof nextHeight === "number" && nextHeight !== selection.height) {
    plan.push({
      attributeId: "Height",
      target: configurationTarget(),
      value: nextHeight,
      origin: "dependency",
      reasonCode: REASON_DEPENDENT_HEIGHT,
    });
  }

  // Leaving a handle that supports a groove for one that does not clears the colour.
  // Decided by the option capability, so a new groove handle needs no id here.
  if (attributeId === "Handle") {
    const hadGroove = hasCapability(profile, "Handle", selection.handle ?? null, "supportsGrooveColor");
    const hasGroove = hasCapability(profile, "Handle", value, "supportsGrooveColor");
    const colorIsSet = Boolean(handleGrooveColor?.trim());

    if (hadGroove && !hasGroove && colorIsSet) {
      plan.push({
        attributeId: "HandleGrooveColor",
        target: { scope: "cabinet", cabinetId: target.scope === "cabinet" ? target.cabinetId : "" },
        // Redux stores "not chosen" as an empty string; the scene token lives in the
        // profile and is applied by I. The two must not substitute for each other.
        value: "",
        origin: "dependency",
        reasonCode: REASON_GROOVE_NOT_SUPPORTED,
      });
    }
  }

  return { ok: true, plan };
};

/** Scene token meaning "no groove colour", for I to apply alongside the empty state value. */
export const resolveGrooveResetToken = (profile: ProductProfile): string =>
  selectResetValue(profile, "HandleGrooveColor") ?? "None";
