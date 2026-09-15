import type { ProductProfile } from "@/entities/collection";
import { hasCapability, selectAttribute, selectMessage, selectResetValue } from "@/entities/collection";
import type { CabinetEntry, ValueTarget } from "@/entities/configuration";
import { applyConfiguratorRules, type Selection } from "@/features/configurator-rule-core/cabinetBuilder";
import { resolveHandleAfterRules } from "@/features/configurator-rule-core/cabinetBuilder/lib/resolveHandleAfterRules";
import type { ConfiguratorCatalog } from "@/shared/config/configurator/typeCabinetCatalog";

import type { ChangeBlockedReason, PlannedChange } from "../model/types";

/**
 * Turns a validated request into the full set of changes that must happen together.
 *
 * The set is what I receives: the requested value plus everything the current rules
 * require alongside it — a forced height, a handle the new drawers need, a colour that no
 * longer applies. Nothing here talks to the scene or the store.
 */

export const REASON_DEPENDENT_HEIGHT = "handle.requiredHeight";
export const REASON_GROOVE_NOT_SUPPORTED = "handle.grooveColorCleared";
export const REASON_HANDLE_CHANGED_FOR_DRAWERS = "drawers.handleChanged";
export const REASON_TOWEL_BAR_COLOR_CLEARED = "towelBar.colorCleared";
export const REASON_GROOVE_FOLLOWS_CABINET_COLOR = "cabinetColor.grooveFollows";

export type BuildChangePlanArgs = {
  /** Current cabinet colour, to decide whether the groove colour follows a new one. */
  cabinetColor?: string | null;
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
  /** Current towel bar colour, to decide whether clearing it is part of the set. */
  towelBarColor?: string | null;
  /** Placed cabinets, for changes that reach every drawer cabinet. */
  cabinets?: readonly CabinetEntry[];
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

/** Catalog rule of a placed product, found by the type code inside its runtime id. */
const findCabinetRule = (runtimeId: string, catalog: ConfiguratorCatalog) => {
  const normalized = runtimeId.toLowerCase();
  return catalog.typeCabinetRules.find((rule) => normalized.includes(rule.code.toLowerCase())) ?? null;
};

const isDrawerCabinet = (runtimeId: string, catalog: ConfiguratorCatalog): boolean => {
  const rule = findCabinetRule(runtimeId, catalog);
  return Boolean(rule && !rule.isOpen);
};

/**
 * Cabinets a drawers change reaches. Drawer styles of different groups cannot be mixed, so
 * the change switches every drawer cabinet at once; open cabinets have no drawers.
 */
const resolveDrawersTargets = (
  target: ValueTarget,
  cabinets: readonly CabinetEntry[],
  catalog: ConfiguratorCatalog,
): ValueTarget[] => {
  if (target.scope !== "cabinet") return [target];

  const drawerCabinetKeys = cabinets
    .filter(({ runtimeId }) => isDrawerCabinet(runtimeId, catalog))
    .map(({ stableKey }) => stableKey);

  const keys = drawerCabinetKeys.includes(target.cabinetId)
    ? drawerCabinetKeys
    : [target.cabinetId, ...drawerCabinetKeys];

  return keys.map((cabinetId) => ({ scope: "cabinet", cabinetId }));
};

/** Leaving a handle that supports a groove for one that does not clears the colour. */
const resolveGrooveReset = (
  profile: ProductProfile,
  previousHandle: string | null | undefined,
  nextHandle: string | null,
  handleGrooveColor: string | null | undefined,
  target: ValueTarget,
): PlannedChange | null => {
  // Decided by the option capability, so a new groove handle needs no id here.
  const hadGroove = hasCapability(profile, "Handle", previousHandle ?? null, "supportsGrooveColor");
  const hasGroove = hasCapability(profile, "Handle", nextHandle, "supportsGrooveColor");

  if (!hadGroove || hasGroove || !handleGrooveColor?.trim()) return null;

  return {
    attributeId: "HandleGrooveColor",
    target: { scope: "cabinet", cabinetId: target.scope === "cabinet" ? target.cabinetId : "" },
    // Redux stores "not chosen" as an empty string; the scene token lives in the
    // profile and is applied by I. The two must not substitute for each other.
    value: "",
    origin: "dependency",
    reasonCode: REASON_GROOVE_NOT_SUPPORTED,
  };
};

export const buildChangePlan = ({
  attributeId,
  value,
  target,
  selection,
  selectedProductIds,
  catalog,
  profile,
  handleGrooveColor,
  cabinetColor,
  towelBarColor,
  cabinets = [],
}: BuildChangePlanArgs): BuildChangePlanResult => {
  const isDrawers = attributeId === "Drawers";
  const requestedTargets = isDrawers ? resolveDrawersTargets(target, cabinets, catalog) : [target];

  const plan: PlannedChange[] = requestedTargets.map((requestedTarget) => ({
    attributeId,
    target: requestedTarget,
    value,
    origin: "requested",
  }));

  // A groove in the cabinet colour follows the cabinet to its new colour, as the colour pages do.
  if (attributeId === "CabinetColor") {
    if (cabinetColor && handleGrooveColor === cabinetColor) {
      plan.push({
        attributeId: "HandleGrooveColor",
        target: { scope: "cabinet", cabinetId: cabinets[0]?.stableKey ?? "" },
        value,
        origin: "dependency",
        reasonCode: REASON_GROOVE_FOLLOWS_CABINET_COLOR,
      });
    }

    return { ok: true, plan };
  }

  // Removing the towel bar clears its colour, as the accessory pages do.
  if (attributeId === "TowelBarOption") {
    const noneValue = selectAttribute(profile, "TowelBarOption")?.noneValue;

    if (noneValue !== undefined && value === noneValue && towelBarColor?.trim()) {
      plan.push({
        attributeId: "TowelBarColor",
        target: configurationTarget(),
        value: "",
        origin: "dependency",
        reasonCode: REASON_TOWEL_BAR_COLOR_CLEARED,
      });
    }

    return { ok: true, plan };
  }

  const selectionField = SELECTION_FIELD_BY_ATTRIBUTE[attributeId];

  // Attributes outside the rule engine's selection carry no dependencies in this slice.
  if (!selectionField) {
    return { ok: true, plan };
  }

  const addressedCabinet =
    target.scope === "cabinet" ? cabinets.find(({ stableKey }) => stableKey === target.cabinetId) : undefined;

  // Drawers are judged for the cabinet they are set on, not for the builder's current pick,
  // and every drawer cabinet switches at once, so cabinets still on the old drawers must not
  // block the height.
  const ruleSelection: Selection = {
    ...selection,
    cabinetType:
      isDrawers && addressedCabinet
        ? (findCabinetRule(addressedCabinet.runtimeId, catalog)?.code ?? selection.cabinetType)
        : selection.cabinetType,
  };
  const ruleProductIds = isDrawers ? [] : selectedProductIds;

  const nextSelection: Selection = { ...ruleSelection, [selectionField]: value };

  const result = applyConfiguratorRules(
    nextSelection,
    { field: selectionField === "cabinetType" ? "cabinetType" : selectionField, value },
    { selectedProductIds: ruleProductIds },
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

  const previousHandle = selection.handle ?? null;
  let nextHandle = attributeId === "Handle" ? value : previousHandle;
  let heightResult = result;

  // New drawers may disallow the current handle; the replacement belongs to the same set.
  if (isDrawers) {
    const resolvedHandle = resolveHandleAfterRules({
      currentHandle: previousHandle,
      handles: result.availableOptions.handles,
      heightLocked: result.heightLocked,
    });

    if (resolvedHandle && resolvedHandle !== previousHandle) {
      nextHandle = resolvedHandle;

      plan.push({
        attributeId: "Handle",
        target: target.scope === "cabinet" ? { scope: "cabinet", cabinetId: target.cabinetId } : target,
        value: resolvedHandle,
        origin: "dependency",
        reasonCode: REASON_HANDLE_CHANGED_FOR_DRAWERS,
      });

      // The forced height is the new handle's, not the old one's.
      heightResult = applyConfiguratorRules(
        { ...nextSelection, handle: resolvedHandle },
        undefined,
        { selectedProductIds: ruleProductIds },
        catalog,
        profile,
      );
    }
  }

  // A rule-driven height belongs to the same set: applying the change without it would
  // leave the scene at a height the rules no longer allow.
  const nextHeight = heightResult.nextSelection.height;

  if (typeof nextHeight === "number" && nextHeight !== selection.height) {
    plan.push({
      attributeId: "Height",
      target: configurationTarget(),
      value: nextHeight,
      origin: "dependency",
      reasonCode: REASON_DEPENDENT_HEIGHT,
    });
  }

  const grooveReset = resolveGrooveReset(profile, previousHandle, nextHandle, handleGrooveColor, target);
  if (grooveReset) plan.push(grooveReset);

  return { ok: true, plan };
};

/** Scene token meaning "no groove colour", for I to apply alongside the empty state value. */
export const resolveGrooveResetToken = (profile: ProductProfile): string =>
  selectResetValue(profile, "HandleGrooveColor") ?? "None";
