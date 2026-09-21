import type { UnknownAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import { normalizeOptionValue } from "@/entities/collection";
import type { ProductProfile, RuntimeFlow } from "@/entities/collection";
import type { ConfiguratorGroupCatalog } from "@/entities/collection/model/types";
import {
  getActiveProductProfile,
  getActiveRuntimeBindings,
  markRuntimeOutOfSync,
  requestSceneStateSync,
} from "@/entities/configuration";
import type {
  ConfigurationCompositionPort,
  ConfigurationRuntimePort,
  ConfigurationSidePanelPort,
  SceneCompositionPlacement,
  SceneCompositionProduct,
  SceneCompositionResult,
  SceneStateResult,
} from "@/entities/configuration";
import { recordComposition } from "@/entities/product/model/store/slice";

import { replayValues, type ReplayValues } from "./replayValues";
import { toSceneValue } from "./sceneValue";

/**
 * The composition commands (C06): placing a preset, adding, removing and moving a cabinet, and
 * clearing the scene.
 *
 * Each goes to the scene once, through I's composition port, and records the composition the
 * scene then holds in one write: the products in order and the drawer style of each new one.
 * Stable keys, per-cabinet values and actual sizes follow that write through the existing
 * listeners. A composition the scene did not take is not recorded; one it took only in part is
 * recorded as it is and holds Save until the scene is read again.
 */

export type CompositionDeps = {
  getState: () => RootState;
  dispatch: (action: UnknownAction) => unknown;
  runtime: ConfigurationRuntimePort;
  composition: ConfigurationCompositionPort;
  sidePanels: ConfigurationSidePanelPort;
  flow: RuntimeFlow;
  configurator?: ConfiguratorGroupCatalog | null;
};

export type CompositionErrorCode =
  /** The scene cannot take commands yet; nothing was sent or recorded. */
  | "runtime-not-ready"
  /** The first scene call failed; the scene is unchanged. */
  | "runtime-failed"
  /** The runtime refused the composition before its first call (unknown product type or value). */
  | "composition-rejected"
  /** A product to remove or move is not in the composition. */
  | "unknown-target";

export type CompositionResult =
  | { status: "applied"; productIds: string[]; placed: string[] }
  | { status: "partial"; productIds: string[]; placed: string[]; message: string; needsSync: true }
  | { status: "error"; code: CompositionErrorCode; message: string };

export type ApplyPresetRequest = {
  /** The preset's products, in order. */
  products: readonly SceneCompositionProduct[];
  /** Configuration values every product is placed with. */
  shared?: ReplayValues;
  /** Values sent once the products are placed, for the parts placing does not reach. */
  afterPlacement?: ReplayValues;
};

export type AddCabinetRequest = {
  product: SceneCompositionProduct;
  placement: SceneCompositionPlacement;
  /** Values sent once the cabinet is placed, e.g. the basin colour of a new sink base. */
  afterPlacement?: ReplayValues;
};

export type ClearCompositionRequest = {
  /** Also take the side panels and the towel bar off, which the scene keeps otherwise. */
  resetAddOns: boolean;
};

const productIdsOf = (state: RootState): string[] => state.rootStateUI.product.productIds;

const drawerStyleOf = (profile: ProductProfile | null, config: Record<string, unknown>): string | null =>
  normalizeOptionValue(profile, "Drawers", config.Drawers);

/** Drawer styles of the placed products; product `i` of the request became `placed[i]`. */
const drawerStyles = (
  profile: ProductProfile | null,
  placed: readonly string[],
  products: readonly SceneCompositionProduct[],
): Record<string, string> =>
  placed.length !== products.length
    ? {}
    : Object.fromEntries(
        placed.flatMap((runtimeId, index) => {
          const style = drawerStyleOf(profile, products[index].config);
          return style ? [[runtimeId, style]] : [];
        }),
      );

/** The expected products in the order the scene reports, when it reports them all. */
const inSceneOrder = (expected: readonly string[], scene: SceneStateResult): string[] => {
  if (scene.status !== "ready") return [...expected];

  const wanted = new Set(expected);
  const ordered = scene.order.filter((runtimeId) => wanted.has(runtimeId));
  return ordered.length === expected.length ? ordered : [...expected];
};

type SceneChange = Extract<SceneCompositionResult, { status: "applied" | "partial" }>;

/** A change the scene took at least in part. */
const isSceneChange = (result: SceneCompositionResult): result is SceneChange =>
  result.status === "applied" || result.status === "partial";

/** The error for a change the scene did not take; nothing was recorded for it. */
const stoppedResult = (result: Exclude<SceneCompositionResult, SceneChange>): CompositionResult => {
  switch (result.status) {
    case "not-ready":
      return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet." };

    case "rejected":
      return {
        status: "error",
        code: "composition-rejected",
        message: result.issues.map(({ message }) => message).join(" "),
      };

    case "failed":
      return { status: "error", code: "runtime-failed", message: result.message };
  }
};

/** Records the composition the scene holds and reports what happened. */
const recordResult = (
  { dispatch }: CompositionDeps,
  result: SceneChange,
  productIds: string[],
  placedCabinetStyles: Record<string, string>,
): CompositionResult => {
  dispatch(recordComposition({ productIds, placedCabinetStyles }));

  if (result.status === "partial") {
    dispatch(markRuntimeOutOfSync());
    dispatch(requestSceneStateSync());
    return { status: "partial", productIds, placed: result.placed, message: result.message, needsSync: true };
  }

  return { status: "applied", productIds, placed: result.placed };
};

/** Sends the values placing does not reach. A value the scene refused holds Save like a partial change. */
const sendAfterPlacement = async (
  deps: CompositionDeps,
  recorded: CompositionResult,
  values: ReplayValues | undefined,
): Promise<CompositionResult> => {
  if (!values || recorded.status !== "applied") return recorded;

  const replayed = await replayValues({ send: values, record: false }, deps);
  if (replayed.status === "applied") return recorded;

  deps.dispatch(markRuntimeOutOfSync());
  return {
    status: "partial",
    productIds: recorded.productIds,
    placed: recorded.placed,
    message: replayed.status === "error" ? replayed.message : "The scene took only part of the values.",
    needsSync: true,
  };
};

export const applyPreset = async (
  { products, shared = {}, afterPlacement }: ApplyPresetRequest,
  deps: CompositionDeps,
): Promise<CompositionResult> => {
  const state = deps.getState();
  const profile = getActiveProductProfile(state);
  const bindings = getActiveRuntimeBindings(state);
  const sceneShared = Object.fromEntries(
    Object.entries(shared).map(([attributeId, value]) => [
      attributeId,
      toSceneValue(profile, bindings, attributeId, value),
    ]),
  );

  const result = await deps.composition.replace({ products, shared: sceneShared, flow: deps.flow });
  if (!isSceneChange(result)) return stoppedResult(result);

  const recorded = recordResult(
    deps,
    result,
    inSceneOrder(result.placed, result.scene),
    drawerStyles(profile, result.placed, products),
  );

  return sendAfterPlacement(deps, recorded, afterPlacement);
};

export const addCabinet = async (
  { product, placement, afterPlacement }: AddCabinetRequest,
  deps: CompositionDeps,
): Promise<CompositionResult> => {
  const result = await deps.composition.add(product, placement);
  if (!isSceneChange(result)) return stoppedResult(result);

  const [runtimeId] = result.placed;
  const current = productIdsOf(deps.getState()).filter((id) => id !== runtimeId);
  const anchor = placement.kind === "beside" ? current.indexOf(placement.anchorRuntimeId) : -1;
  const at =
    anchor === -1 ? current.length : placement.kind === "beside" && placement.side === "left" ? anchor : anchor + 1;
  const expected = runtimeId ? [...current.slice(0, at), runtimeId, ...current.slice(at)] : current;
  const style = runtimeId ? drawerStyleOf(getActiveProductProfile(deps.getState()), product.config) : null;

  const recorded = recordResult(
    deps,
    result,
    inSceneOrder(expected, result.scene),
    runtimeId && style ? { [runtimeId]: style } : {},
  );

  return sendAfterPlacement(deps, recorded, afterPlacement);
};

export const removeCabinets = async (
  runtimeIds: readonly string[],
  deps: CompositionDeps,
): Promise<CompositionResult> => {
  const current = productIdsOf(deps.getState());
  const unknown = runtimeIds.filter((runtimeId) => !current.includes(runtimeId));

  if (runtimeIds.length === 0 || unknown.length > 0) {
    return { status: "error", code: "unknown-target", message: `Not in the composition: ${unknown.join(", ")}.` };
  }

  const result = await deps.composition.remove(runtimeIds);
  if (!isSceneChange(result)) return stoppedResult(result);

  const placedNow = productIdsOf(deps.getState());
  const { scene } = result;
  // A partial removal stopped at a product the scene kept; what is left is what the scene reads.
  const remaining =
    result.status === "applied"
      ? placedNow.filter((runtimeId) => !runtimeIds.includes(runtimeId))
      : scene.status === "ready"
        ? placedNow.filter((runtimeId) => scene.order.includes(runtimeId))
        : placedNow;

  return recordResult(deps, result, inSceneOrder(remaining, result.scene), {});
};

export const swapCabinets = async (
  runtimeIdA: string,
  runtimeIdB: string,
  deps: CompositionDeps,
): Promise<CompositionResult> => {
  const current = productIdsOf(deps.getState());

  if (runtimeIdA === runtimeIdB || !current.includes(runtimeIdA) || !current.includes(runtimeIdB)) {
    return { status: "error", code: "unknown-target", message: `Cannot swap ${runtimeIdA} and ${runtimeIdB}.` };
  }

  const result = await deps.composition.swap(runtimeIdA, runtimeIdB);
  if (!isSceneChange(result)) return stoppedResult(result);

  const swapped = productIdsOf(deps.getState()).map((runtimeId) =>
    runtimeId === runtimeIdA ? runtimeIdB : runtimeId === runtimeIdB ? runtimeIdA : runtimeId,
  );

  return recordResult(deps, result, inSceneOrder(swapped, result.scene), {});
};

export const clearComposition = async (
  { resetAddOns }: ClearCompositionRequest,
  deps: CompositionDeps,
): Promise<CompositionResult> => {
  if (!deps.composition.isReady()) {
    return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet." };
  }

  // The scene keeps its add-ons when the products go, and would put them back on the next ones.
  if (resetAddOns) {
    const towelBar = await replayValues({ send: { TowelBarOption: "None" }, record: false }, deps);
    const sidePanels = await deps.sidePanels.apply([{ panel: "None", side: "both" }]);

    if (towelBar.status !== "applied" || sidePanels.status !== "applied") {
      console.warn("[clearComposition] The add-ons were not all taken off", { towelBar, sidePanels });
    }
  }

  const result = await deps.composition.clear();
  if (!isSceneChange(result)) return stoppedResult(result);

  return recordResult(deps, result, [], {});
};
