import type { RootState } from "@/app/store";
import {
  normalizeOptionValue,
  selectConfiguratorGroup,
  selectFollowedAttribute,
  selectResetValue,
  selectRuntimeBinding,
  semanticValueOf,
  type ProductProfile,
} from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getAttributeValue,
  getCabinetEntries,
  getCompositionValues,
  isSameTarget,
  isSinkBase,
} from "@/entities/configuration";
import type { CabinetEntry, ValueTarget } from "@/entities/configuration";
import { getCabinetCatalog, getSinkType, getVesselColor } from "@/entities/product/model/store/selectors";
import { findUndeterminedRule, isUndeterminedAt } from "@/entities/product/model/store/undeterminedRules";
import { resolveConfiguratorOptions } from "@/features/collectionCustomization";
import type { Selection } from "@/features/configurator-rule-core/cabinetBuilder";
import { seriesOfConfig } from "@/shared/config/configurator/typeCabinetCatalog";

import { checkAvailability } from "./availabilityGates";
import { buildChangePlan } from "./buildChangePlan";
import type { BuildChangePlanArgs } from "./buildChangePlan";
import { resolveConfirmation } from "./confirmationPolicy";
import { findSinkBaseKeys } from "./isSinkBase";
import { resolveTarget } from "./resolveTarget";
import { checkUndetermined, planUndeterminedResets } from "./undeterminedGate";
import { validateChange } from "./validateChange";
import { evaluateCountertopChange } from "./countertopCompatibility";
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
    series: seriesOfConfig(config),
  };
};

/** A value the collection offers: an option its profile lists, or one of the configurator section it names. */
const isOfferedValue = (
  profile: ProductProfile | null,
  configurator: ConfiguratorGroupCatalog | null,
  attributeId: string,
  value: string,
): boolean =>
  normalizeOptionValue(profile, attributeId, value) !== null ||
  Boolean(
    selectConfiguratorGroup(profile, attributeId, configurator)?.options.some(({ variants }) =>
      variants.some((variant) => (variant.metadata?.value ?? variant.name) === value),
    ),
  );

/**
 * What an attribute that follows another needs from state: the value the followed one holds before the change, and
 * the follower's own value at the first cabinet the product decided it for, where a field reads it. A cabinet with
 * nothing decided (a one-drawer Mako cabinet has no legs) is passed over, so a composition that starts with one reads
 * the legs of the next. The follower takes a new value only where a pick of it could: offered as a choice of its
 * field, not its reset value, allowed by the current rules and decided at the cabinet as the set leaves it.
 */
const readFollowState = (
  state: RootState,
  profile: ProductProfile,
  cabinets: readonly CabinetEntry[],
  configurator: ConfiguratorGroupCatalog | null,
): Pick<BuildChangePlanArgs, "followedValues" | "heldFollowerValues" | "canFollow"> => {
  const compositionValues = getCompositionValues(state);
  const followedValues: Record<string, string> = {};
  const heldFollowerValues: Record<string, { value: string; target: ValueTarget }> = {};

  for (const { attributeId, scope } of profile.attributes) {
    const followedId = selectFollowedAttribute(profile, attributeId);
    if (followedId === null || scope !== "cabinet") continue;

    const followed = compositionValues[followedId];
    if (typeof followed === "string") followedValues[followedId] = followed;

    const target: ValueTarget | undefined = cabinets
      .map(({ stableKey }): ValueTarget => ({ scope: "cabinet", cabinetId: stableKey }))
      .find((cabinetTarget) => !isUndeterminedAt(state, profile, attributeId, cabinetTarget));
    const held = target ? getAttributeValue(state, attributeId, target) : undefined;
    // Switched off (empty or the reset value) stays off.
    if (target && typeof held === "string" && held.trim() && held !== selectResetValue(profile, attributeId)) {
      heldFollowerValues[attributeId] = { value: held, target };
    }
  }

  const canFollow: NonNullable<BuildChangePlanArgs["canFollow"]> = (attributeId, value, target, plan) => {
    // The cabinet as the set leaves it: drawers changed in the same set can leave the follower undecided there.
    const planned = Object.fromEntries(
      plan
        .filter((entry) => isSameTarget(entry.target, target))
        .map((entry) => [entry.attributeId, String(entry.value ?? "")]),
    );

    return (
      value !== selectResetValue(profile, attributeId) &&
      resolveConfiguratorOptions(profile, attributeId, configurator).some(
        (option) => option.enabled && option.value === value,
      ) &&
      !checkAvailability(attributeId, value, state, profile) &&
      !findUndeterminedRule(state, profile, attributeId, value, target, planned)
    );
  };

  return { followedValues, heldFollowerValues, canFollow };
};

export const evaluateChange = (
  requested: AttributeChange,
  state: RootState,
  /** Configurator sections of the active collection, for the material of a colour it lists. */
  configurator: ConfiguratorGroupCatalog | null = null,
): ChangeEvaluation => {
  const profile = getActiveProductProfile(state);
  const cabinets = getCabinetEntries(state);
  // A value read back from the scene ("Nero 433 Lacquered MT") changes the configuration value the
  // bindings send as it ("Nero 433 MT"). A value the collection offers is never translated.
  const change =
    typeof requested.value === "string" &&
    !isOfferedValue(profile, configurator, requested.attributeId, requested.value)
      ? {
          ...requested,
          value: semanticValueOf(getActiveRuntimeBindings(state), requested.attributeId, requested.value),
        }
      : requested;

  // Gates 1-3: attribute known, scope matches, value in catalog.
  const verdict = validateChange(change, profile);

  if (!verdict.ok) {
    return verdict.kind === "error"
      ? { kind: "error", code: verdict.code, message: verdict.message }
      : { kind: "blocked", attributeId: verdict.attributeId, reasonCode: verdict.reasonCode, reason: verdict.reason };
  }

  const targetResult = resolveTarget(change, cabinets, (runtimeId) => isSinkBase(state, runtimeId));

  if (!targetResult.ok) {
    return { kind: "error", code: "unknown-target", message: targetResult.message };
  }

  // One cabinet alone can change only where the scene keeps the value per product; elsewhere the
  // scene would give it to every cabinet, which is not what was asked.
  const onlyThisCabinet = change.scope === "cabinet" && change.onlyThisCabinet === true;
  if (onlyThisCabinet) {
    const bindings = getActiveRuntimeBindings(state);
    const binding = bindings ? selectRuntimeBinding(bindings, change.attributeId) : null;

    // A value sent to one product anyway needs no leave for it.
    const reachesOneProduct = binding?.status === "bound" && (binding.perProduct || binding.target.kind === "product");
    if (!reachesOneProduct) {
      return {
        kind: "error",
        code: "scope-mismatch",
        message: `attribute "${change.attributeId}" cannot be changed for one cabinet alone`,
      };
    }
  }

  // `profile` is non-null here: validateChange returns an error otherwise.
  const activeProfile = profile as NonNullable<typeof profile>;

  // A change the product has no rule for yet changes nothing (CONTRACTS §8).
  const undetermined = checkUndetermined(change, targetResult.target, state, activeProfile);
  if (undetermined) return { kind: "blocked", ...undetermined };

  // Gate 4 for attributes outside the rule selection.
  const unavailable = checkAvailability(change.attributeId, change.value, state, activeProfile);
  if (unavailable) return { kind: "blocked", ...unavailable };
  const countertop = evaluateCountertopChange(change, targetResult.target, state, activeProfile, configurator);
  if (countertop.blocked) return { kind: "blocked", ...countertop.blocked };

  const heldHandleColor = getCompositionValues(state).HandleColor;

  // Gate 4 for the rule selection, plus the dependent changes.
  const planResult = buildChangePlan({
    attributeId: change.attributeId,
    value: String(change.value ?? ""),
    target: targetResult.target,
    selection: toSelection(state),
    selectedProductIds: state.rootStateUI.product.productIds,
    catalog: getCabinetCatalog(state),
    profile: activeProfile,
    handleGrooveColor: state.rootStateUI.product.productOptions.HandleGrooveColor,
    handleColor: typeof heldHandleColor === "string" ? heldHandleColor : null,
    cabinetColor: state.rootStateUI.product.productOptions.CabinetColor,
    patternValues: Object.fromEntries(
      cabinets.map(({ stableKey }) => [
        stableKey,
        String(
          getAttributeValue(state, "DrawerPanelFluting", { scope: "cabinet", cabinetId: stableKey }) ??
            state.rootStateUI.product.productOptions.DrawerPanelFluting ??
            "",
        ),
      ]),
    ),
    towelBarColor: state.rootStateUI.product.productOptions.TowelBarColor,
    basin: {
      sinkBaseIds: findSinkBaseKeys(state),
      sinkType: getSinkType(state),
      vesselColor: getVesselColor(state),
    },
    cabinets,
    configurator,
    placedCabinetStyles: state.rootStateUI.product.placedCabinetStyles,
    runtimeBindings: getActiveRuntimeBindings(state),
    ...readFollowState(state, activeProfile, cabinets, configurator),
  });

  if (!planResult.ok) {
    return {
      kind: "blocked",
      attributeId: planResult.attributeId,
      reasonCode: planResult.reasonCode,
      reason: planResult.reason,
    };
  }

  const bindings = getActiveRuntimeBindings(state);
  const requestedBinding = bindings ? selectRuntimeBinding(bindings, change.attributeId) : null;
  // Shared fields set every cabinet even when the scene requires one product address.
  // Separate changes preserve per-cabinet results, overrides and replay.
  const applyToEveryProduct =
    !onlyThisCabinet &&
    requestedBinding?.status === "bound" &&
    requestedBinding.perProduct &&
    requestedBinding.target.kind === "product";
  const requestedPlan = onlyThisCabinet
    ? planResult.plan.map((entry) =>
        entry.origin === "requested" && entry.attributeId === change.attributeId
          ? { ...entry, onlyThisCabinet: true }
          : entry,
      )
    : applyToEveryProduct
      ? planResult.plan.flatMap((entry) =>
          entry.origin === "requested" && entry.attributeId === change.attributeId && entry.target.scope === "cabinet"
            ? cabinets.map(({ stableKey }) => ({
                ...entry,
                target: { scope: "cabinet" as const, cabinetId: stableKey },
              }))
            : [entry],
        )
      : planResult.plan;
  // A value the new drawers leave undetermined goes with them (the legs of a one-drawer Mako cabinet).
  const undeterminedResets = planUndeterminedResets(planResult.plan, state, activeProfile);

  return {
    kind: "planned",
    plan: [...requestedPlan, ...undeterminedResets, ...countertop.dependencies],
    // The countertop asks too when it changes the cabinets under it (Tricot: Integrated over an inner drawer).
    confirmation: [
      ...resolveConfirmation(change, planResult.plan, activeProfile, cabinets.length),
      ...(countertop.confirmation ?? []),
    ],
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
        ...(evaluation.compatibility ? { compatibility: evaluation.compatibility } : {}),
      };
