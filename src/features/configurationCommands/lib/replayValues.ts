import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { resolveRuntimeBinding, selectAttribute } from "@/entities/collection";
import type { ProductProfile, RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getActiveCollectionId,
  getActiveProductProfile,
  getActiveRuntimeBindings,
  getAttributeScope,
  getCabinetEntries,
  markRuntimeOutOfSync,
  requestSceneStateSync,
} from "@/entities/configuration";
import type { AttributeValue, ConfigurationRuntimePort, ValueTarget } from "@/entities/configuration";

import { buildCommitContext, buildRuntimeContext } from "./applyPlan";
import { commitPlan } from "./commitChange";
import { toSceneValue } from "./sceneValue";
import type { ChangeErrorCode, FailedChange, PlannedChange } from "../model/types";

/**
 * Shows values the configuration already holds on the scene again.
 *
 * Undo, redo and opening a saved configuration rebuild the products, then the scene has to
 * show the configuration's values on them. Those values were checked when they were chosen,
 * so they are not validated, planned or confirmed again: each is addressed at the scope its
 * profile attribute declares, and the set goes through the runtime port once, in the phases
 * the collection declares. A value the scene has no translation for is reported in `skipped`
 * and the rest is still sent, so one stale value does not leave the whole scene behind.
 */

export type ReplayValues = Readonly<Record<string, AttributeValue>>;

export type ReplayRequest = {
  /** Values the scene shows again. */
  send?: ReplayValues;
  /** Values only the state keeps. Recorded together with the sent ones. */
  recordOnly?: ReplayValues;
  /** False when the state already holds the values, e.g. an undo restored it as a whole. */
  record: boolean;
};

export type SkippedReplayValue = {
  attributeId: string;
  value: AttributeValue;
  reason: "no-target" | "no-translation";
};

export type ReplayResult =
  | { status: "applied"; applied: PlannedChange[]; skipped: SkippedReplayValue[] }
  | {
      status: "partial";
      applied: PlannedChange[];
      failed: FailedChange[];
      skipped: SkippedReplayValue[];
      needsSync: true;
    }
  | { status: "error"; code: ChangeErrorCode; message: string; skipped: SkippedReplayValue[] };

export type ReplayDeps = {
  getState: () => RootState;
  dispatch: (action: UnknownAction) => unknown;
  runtime: ConfigurationRuntimePort;
  flow: RuntimeFlow;
  configurator?: ConfiguratorGroupCatalog | null;
};

/**
 * Where a value of the whole configuration lives. A cabinet value names the first cabinet,
 * as a field does; its binding decides which products the scene updates. A basin value names
 * no sink base, so it reaches every basin. A drawer value is per drawer and cannot be replayed
 * as one value. A value the profile does not declare, such as one a save only carries along,
 * is addressed at the scope its ownership records.
 */
const replayTarget = (state: RootState, profile: ProductProfile, attributeId: string): ValueTarget | null => {
  switch (selectAttribute(profile, attributeId)?.scope ?? getAttributeScope(attributeId)) {
    case "global":
      return { scope: "global" };

    case "countertop":
      return { scope: "countertop" };

    case "basin":
      return { scope: "basin" };

    case "cabinet": {
      const cabinetId = getCabinetEntries(state)[0]?.stableKey;
      return cabinetId ? { scope: "cabinet", cabinetId } : null;
    }

    default:
      return null;
  }
};

const toChanges = (
  state: RootState,
  profile: ProductProfile,
  values: ReplayValues,
  toValue: (attributeId: string, value: AttributeValue) => AttributeValue,
  skipped: SkippedReplayValue[],
): PlannedChange[] =>
  Object.entries(values).flatMap(([attributeId, value]) => {
    const target = replayTarget(state, profile, attributeId);

    if (!target) {
      skipped.push({ attributeId, value, reason: "no-target" });
      return [];
    }

    return [{ attributeId, target, value: toValue(attributeId, value), origin: "requested" as const }];
  });

export const replayValues = async (
  { send = {}, recordOnly = {}, record }: ReplayRequest,
  { getState, dispatch, runtime, flow, configurator }: ReplayDeps,
): Promise<ReplayResult> => {
  const state = getState();
  const profile = getActiveProductProfile(state);
  const collectionId = getActiveCollectionId(state);
  const skipped: SkippedReplayValue[] = [];

  if (!profile || !collectionId) {
    return { status: "error", code: "no-active-profile", message: "No collection profile is loaded.", skipped };
  }

  const bindings = getActiveRuntimeBindings(state);
  const sendChanges = toChanges(
    state,
    profile,
    send,
    (attributeId, value) => toSceneValue(profile, bindings, attributeId, value),
    skipped,
  ).filter((change) => {
    // Without the collection's bindings the port reports the whole set as unsupported.
    if (!bindings) return true;

    const resolution = resolveRuntimeBinding(bindings, change.attributeId, change.value, flow);
    if (resolution.ok) return true;

    skipped.push({ attributeId: change.attributeId, value: change.value, reason: "no-translation" });
    return false;
  });
  const recordChanges = record ? toChanges(state, profile, recordOnly, (_, value) => value, skipped) : [];

  const context = buildRuntimeContext(state, collectionId, flow);
  const runtimeResult = await runtime.apply(sendChanges, context);

  // Nothing reached the scene: nothing is recorded.
  switch (runtimeResult.status) {
    case "not-ready":
      return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet.", skipped };

    case "unsupported":
      return {
        status: "error",
        code: "runtime-unsupported",
        message: `No scene translation for ${runtimeResult.unsupported.map(({ change }) => change.attributeId).join(", ")}.`,
        skipped,
      };

    case "failed":
      return {
        status: "error",
        code: "runtime-failed",
        message: runtimeResult.failed[0]?.message ?? "The scene did not apply the values.",
        skipped,
      };
  }

  if (record) {
    const commitContext = buildCommitContext(getState(), context, configurator);
    // The scene got the canonical value; the state keeps the value as it was given.
    const applied = runtimeResult.applied.map((change) =>
      Object.hasOwn(send, change.attributeId) ? { ...change, value: send[change.attributeId] } : change,
    );

    for (const action of commitPlan([...applied, ...recordChanges], commitContext)) {
      dispatch(action);
    }
  }

  if (runtimeResult.status === "partial") {
    dispatch(markRuntimeOutOfSync());
    dispatch(requestSceneStateSync());
    return {
      status: "partial",
      applied: runtimeResult.applied,
      failed: runtimeResult.failed,
      skipped,
      needsSync: true,
    };
  }

  return { status: "applied", applied: runtimeResult.applied, skipped };
};

export type RecordValuesResult = { recorded: PlannedChange[]; skipped: SkippedReplayValue[] };

/**
 * Records values the scene already shows, or never shows, without a scene call: what a preset,
 * a restore or a kept composition brings along. Synchronous, so a page that resets its state and
 * records these values in the same step never renders the reset in between.
 */
export const recordValues = (
  values: ReplayValues,
  { getState, dispatch, flow, configurator }: Omit<ReplayDeps, "runtime">,
): RecordValuesResult => {
  const state = getState();
  const profile = getActiveProductProfile(state);
  const skipped: SkippedReplayValue[] = [];

  if (!profile) {
    return {
      recorded: [],
      skipped: Object.entries(values).map(([attributeId, value]) => ({ attributeId, value, reason: "no-target" })),
    };
  }

  const changes = toChanges(state, profile, values, (_, value) => value, skipped);
  const context = buildRuntimeContext(state, getActiveCollectionId(state) ?? profile.collectionId, flow);

  for (const action of commitPlan(changes, buildCommitContext(state, context, configurator))) {
    dispatch(action);
  }

  return { recorded: changes, skipped };
};
