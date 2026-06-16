/**
 * Side Panel Service — centralized business logic for side panel operations.
 *
 * All SP mutations (groove change, per-side enable/disable, auto-remove/restore)
 * go through this service. Components should use the `useSidePanelActions` hook
 * which wraps these functions with dispatch.
 */

import type { AppDispatch } from "@/app/store";
import { setSidePanelsOption, setSidePanelSideStatus } from "@/entities/product/model/store/slice";
import { setSidePanel } from "@/utils/functions/playcanvas/sidePanels";
import { mapCabinetTypeToGroup } from "../model/selectors";
import { mapSidePanelDrawersToHandleType } from "./sidePanelEdgeCompatibility";
import { sidePanelAvailabilityRule } from "./sidePanelRules";

export type SidePanelSide = "left" | "right";
export type SidePanelStatus = "active" | "none" | "auto-removed";
export type GrooveType = "NoG" | "UpperG" | "CenterG" | "DoubleG" | "None";
const GROOVE_VALUES = ["NoG", "UpperG", "CenterG", "DoubleG", "None"] as const;

export type ApplyGrooveOptions = {
  currentLeftStatus?: SidePanelStatus;
  currentRightStatus?: SidePanelStatus;
};

type PresetSidePanelProduct = {
  name?: string;
  Handle?: string;
  Height?: number;
  Drawers?: string;
};

type PresetEdge = {
  side: SidePanelSide;
  product: PresetSidePanelProduct | undefined;
  productId: string | undefined;
};

export function isGrooveType(value: string): value is GrooveType {
  return (GROOVE_VALUES as readonly string[]).includes(value);
}

// ── Shared groove resolution ───────────────────────────────────────────

const HANDLE_GROOVE_PRIORITY: Record<string, readonly string[]> = {
  handle_urban_topcut: ["UpperG", "DoubleG"],
  handle_urban_botcut: ["CenterG"],
  handle_pto: ["NoG"],
};

const GROOVE_FALLBACK = ["UpperG", "CenterG", "DoubleG", "NoG"] as const;

/**
 * Pick the best groove given allowed set, current groove, and handle style.
 * 1) Keep current if still allowed
 * 2) Pick preferred by handle priority
 * 3) Fallback to first available (NoG last)
 */
export function resolveGroove(
  allowed: Set<string>,
  currentGroove: string | null,
  handle: string | null,
): GrooveType {
  if (currentGroove && allowed.has(currentGroove) && isGrooveType(currentGroove)) return currentGroove;

  const priorities = handle ? HANDLE_GROOVE_PRIORITY[handle] ?? [] : [];
  const preferred = priorities.find((g) => allowed.has(g));
  if (preferred && isGrooveType(preferred)) return preferred;

  return GROOVE_FALLBACK.find((g) => allowed.has(g)) ?? "None";
}

// ── Internal helper ─────────────────────────────────────────────────────

function dispatchSideStatus(
  dispatch: AppDispatch,
  side: "left" | "right" | "both",
  status: SidePanelStatus,
) {
  if (side === "both") {
    dispatch(setSidePanelSideStatus({ side: "left", status }));
    dispatch(setSidePanelSideStatus({ side: "right", status }));
  } else {
    dispatch(setSidePanelSideStatus({ side, status }));
  }
}

const getPresetEdges = (presetProducts: PresetSidePanelProduct[], productIds?: string[]): PresetEdge[] => [
  { side: "left", product: presetProducts[0], productId: productIds?.[0] },
  {
    side: "right",
    product: presetProducts[presetProducts.length - 1],
    productId: productIds?.[presetProducts.length - 1],
  },
];

const isSidePanelEligiblePresetEdge = (product: PresetSidePanelProduct | undefined) =>
  mapCabinetTypeToGroup(product?.name ?? null) === "SBSC";

const dispatchPresetEdgeStatuses = (
  dispatch: AppDispatch,
  edges: PresetEdge[],
  activeSides: ReadonlySet<SidePanelSide>,
) => {
  edges.forEach(({ side }) => {
    dispatch(setSidePanelSideStatus({ side, status: activeSides.has(side) ? "active" : "auto-removed" }));
  });
};

const normalizeProductIds = (productIds?: string[]) =>
  productIds?.filter((productId) => productId.trim().length > 0);

// ── Public API ──────────────────────────────────────────────────────────

/**
 * User selects groove type in Accessories UI.
 * Updates PlayCanvas + Redux groove + per-side status.
 * @param side — which edge cabinet was selected ("both" for single cabinet)
 * @param cabinetCount — number of cabinets on scene (1 = single-cabinet API)
 */
export async function applyGroove(
  dispatch: AppDispatch,
  groove: GrooveType,
  side: "left" | "right" | "both",
  cabinetCount?: number,
  options?: ApplyGrooveOptions,
) {
  await setSidePanel(groove, side, cabinetCount);
  dispatchSideStatus(dispatch, side, groove === "None" ? "none" : "active");

  const changedSideStatus = groove === "None" ? "none" : "active";
  const nextLeftStatus =
    side === "both" || side === "left" ? changedSideStatus : options?.currentLeftStatus;
  const nextRightStatus =
    side === "both" || side === "right" ? changedSideStatus : options?.currentRightStatus;
  const hasActiveSideAfterChange = nextLeftStatus === "active" || nextRightStatus === "active";

  if (groove !== "None" || !options || !hasActiveSideAfterChange) {
    dispatch(setSidePanelsOption(groove));
  }
}

/**
 * User deletes SP entity via context menu in 3D player.
 * Clears PlayCanvas SP on that side, marks as user-removed (won't auto-restore).
 *
 * The `SidePanels` option encodes the groove type used by active sides (it is read on
 * save/restore). Keep it while the other side still has a panel; only reset it to "None"
 * when no side remains active. Pass `remainingSideStatus` to preserve the groove.
 */
export async function deleteSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
  cabinetCount?: number,
  remainingSideStatus?: SidePanelStatus,
) {
  await setSidePanel("None", side, cabinetCount);
  dispatch(setSidePanelSideStatus({ side, status: "none" }));
  if (remainingSideStatus !== "active") {
    dispatch(setSidePanelsOption("None"));
  }
}

/**
 * System auto-removes SP when OS/OSS cabinet appears at edge.
 * Will auto-restore when edge becomes eligible again (SB/SC).
 */
export async function autoRemoveSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
  cabinetCount?: number,
) {
  await setSidePanel("None", side, cabinetCount);
  dispatch(setSidePanelSideStatus({ side, status: "auto-removed" }));
}

/**
 * System auto-restores SP when edge cabinet becomes eligible (was auto-removed).
 * Does NOT restore user-removed ("none") sides.
 */
export async function autoRestoreSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
  groove: GrooveType,
  cabinetCount?: number,
) {
  await setSidePanel(groove, side, cabinetCount);
  dispatch(setSidePanelSideStatus({ side, status: "active" }));
}

/**
 * Initial SP setup from preset or cabinet builder boot.
 * Sets groove + both sides active.
 */
export async function bootBothSides(
  dispatch: AppDispatch,
  groove: GrooveType,
  cabinetCount?: number,
) {
  await setSidePanel(groove, "both", cabinetCount);
  dispatch(setSidePanelsOption(groove));
  dispatchSideStatus(dispatch, "both", "active");
}

/**
 * Middleware use: groove type changed (handle/drawer switch).
 * Applies new groove only to sides that are currently "active".
 * Skips "none" (user-removed) and "auto-removed" sides.
 */
export async function applyGrooveToActiveSides(
  dispatch: AppDispatch,
  groove: GrooveType,
  leftStatus: SidePanelStatus,
  rightStatus: SidePanelStatus,
  cabinetCount?: number,
) {
  const nextStatus: SidePanelStatus = groove === "None" ? "auto-removed" : "active";

  if (leftStatus === "active") {
    await setSidePanel(groove, "left", cabinetCount);
    dispatch(setSidePanelSideStatus({ side: "left", status: nextStatus }));
  }
  if (rightStatus === "active") {
    await setSidePanel(groove, "right", cabinetCount);
    dispatch(setSidePanelSideStatus({ side: "right", status: nextStatus }));
  }
  dispatch(setSidePanelsOption(groove));
}

/**
 * Auto-remove both sides when total vanity width = 340cm.
 * Both sides marked "auto-removed" (will restore when width changes).
 */
export async function autoRemoveBoth(dispatch: AppDispatch, cabinetCount?: number) {
  await setSidePanel("None", "both", cabinetCount);
  dispatch(setSidePanelsOption("None"));
  dispatchSideStatus(dispatch, "both", "auto-removed");
}

/**
 * Re-apply SP after preset switch in prebuilt mode.
 * Does NOT preserve previous per-side state — preset switch is a fresh start.
 * Puts SP on every eligible edge (SB/SC), skips ineligible edges (OS/OSS).
 */
export async function reapplySidePanelsForPreset(
  dispatch: AppDispatch,
  currentGroove: string,
  presetProducts: PresetSidePanelProduct[],
  cabinetCount?: number,
  productIds?: string[],
) {
  if (!currentGroove || currentGroove === "None" || !isGrooveType(currentGroove)) return;
  if (!presetProducts.length) return;

  const count = cabinetCount ?? presetProducts.length;
  const scopedProductIds = normalizeProductIds(productIds);
  const scopeOptions = scopedProductIds?.length ? { productIds: scopedProductIds } : undefined;
  const edges = getPresetEdges(presetProducts, scopedProductIds);
  const eligibleEdges = edges.filter(({ product }) => isSidePanelEligiblePresetEdge(product));
  const eligible = eligibleEdges[0]?.product;

  // Always clear stale physical panels before mapping the saved groove onto the
  // new preset edges. A preset with shelf ends may have no side that can receive SP.
  await setSidePanel("None", "both", count, scopeOptions);

  if (!eligible) {
    dispatchPresetEdgeStatuses(dispatch, edges, new Set());
    dispatch(setSidePanelsOption(currentGroove));
    return;
  }

  const availability = sidePanelAvailabilityRule({
    height: eligible.Height ?? null,
    handleType: mapSidePanelDrawersToHandleType(eligible.Drawers),
    cabinetType: "SBSC",
  });

  const groove = resolveGroove(
    availability.allowed as Set<string>,
    currentGroove,
    eligible.Handle ?? null,
  );

  if (groove === "None") {
    dispatchPresetEdgeStatuses(dispatch, edges, new Set());
    dispatch(setSidePanelsOption(currentGroove));
    return;
  }

  const activeSides = new Set<SidePanelSide>();

  for (const { side, productId } of eligibleEdges) {
    if (activeSides.has(side)) continue;
    const edgeScopeOptions = productId ? { productIds: [productId] } : undefined;
    await setSidePanel(groove, side, count, edgeScopeOptions);
    activeSides.add(side);
  }

  dispatchPresetEdgeStatuses(dispatch, edges, activeSides);
  dispatch(setSidePanelsOption(groove));
}

export async function restoreSidePanelState(
  spGroove: string | undefined,
  spLeft: string | undefined,
  spRight: string | undefined,
  cabinetCount?: number,
) {
  const left = spLeft ?? (spGroove && spGroove !== "None" ? "active" : "none");
  const right = spRight ?? (spGroove && spGroove !== "None" ? "active" : "none");
  const isSingleCabinet = cabinetCount === 1;

  if (!spGroove || spGroove === "None") {
    await setSidePanel("None", "both", cabinetCount);
  } else if (isSingleCabinet && left === "active" && right === "active") {
    await setSidePanel(spGroove, "both", cabinetCount);
  } else {
    await setSidePanel("None", "both", cabinetCount);
    if (left === "active") await setSidePanel(spGroove, "left", cabinetCount);
    if (right === "active") await setSidePanel(spGroove, "right", cabinetCount);
  }
}
