/**
 * Side Panel Service — the side panel rules: which panel goes on which side, and how each side
 * is marked (C06).
 *
 * Every function plans one change and hands it to the side panel command, which places the
 * panels through the scene adapter and records the groove and the per-side statuses once the
 * scene took them. Nothing here calls the scene or writes the state itself. Components use the
 * `useSidePanelActions` hook, which wraps these functions with dispatch.
 */

import type { AppDispatch } from "@/app/store";
import type { ProductProfile } from "@/entities/collection";
import { selectRuleData } from "@/entities/collection";
import {
  changeSidePanels,
  type SidePanelChange,
  type SidePanelChangeResult,
} from "@/features/configurationCommands/lib/changeSidePanels";
import { mapCabinetTypeToGroup } from "../model/selectors";
import { mapSidePanelDrawersToHandleType, sidePanelAvailabilityRule } from "./sidePanelRules";

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
export function resolveGroove(allowed: Set<string>, currentGroove: string | null, handle: string | null): GrooveType {
  if (currentGroove && allowed.has(currentGroove) && isGrooveType(currentGroove)) return currentGroove;

  const priorities = handle ? (HANDLE_GROOVE_PRIORITY[handle] ?? []) : [];
  const preferred = priorities.find((g) => allowed.has(g));
  if (preferred && isGrooveType(preferred)) return preferred;

  return GROOVE_FALLBACK.find((g) => allowed.has(g)) ?? "None";
}

// ── Internal helpers ────────────────────────────────────────────────────

/** Places the panels and records the values through the side panel command. */
const change = (dispatch: AppDispatch, sidePanelChange: SidePanelChange): Promise<SidePanelChangeResult> =>
  changeSidePanels(sidePanelChange, { dispatch });

/** The status of each side a placement reaches. */
const sideStatuses = (side: "left" | "right" | "both", status: SidePanelStatus) =>
  side === "both" ? { left: status, right: status } : { [side]: status };

const getPresetEdges = (presetProducts: PresetSidePanelProduct[], productIds?: string[]): PresetEdge[] => [
  { side: "left", product: presetProducts[0], productId: productIds?.[0] },
  {
    side: "right",
    product: presetProducts[presetProducts.length - 1],
    productId: productIds?.[presetProducts.length - 1],
  },
];

const isSidePanelEligiblePresetEdge = (product: PresetSidePanelProduct | undefined, profile: ProductProfile | null) =>
  mapCabinetTypeToGroup(product?.name ?? null, profile) === "SBSC";

/** Each preset edge is active when it received a panel, otherwise auto-removed. */
const presetEdgeStatuses = (edges: PresetEdge[], activeSides: ReadonlySet<SidePanelSide>) =>
  Object.fromEntries(edges.map(({ side }) => [side, activeSides.has(side) ? "active" : "auto-removed"] as const)) as {
    left?: SidePanelStatus;
    right?: SidePanelStatus;
  };

const normalizeProductIds = (productIds?: string[]) => productIds?.filter((productId) => productId.trim().length > 0);

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
  const changedSideStatus = groove === "None" ? "none" : "active";
  const nextLeftStatus = side === "both" || side === "left" ? changedSideStatus : options?.currentLeftStatus;
  const nextRightStatus = side === "both" || side === "right" ? changedSideStatus : options?.currentRightStatus;
  const hasActiveSideAfterChange = nextLeftStatus === "active" || nextRightStatus === "active";

  return change(dispatch, {
    placements: [{ panel: groove, side }],
    cabinetCount,
    record: {
      ...sideStatuses(side, changedSideStatus),
      // Removing one side keeps the groove the other side still shows.
      ...(groove !== "None" || !options || !hasActiveSideAfterChange ? { panels: groove } : {}),
    },
  });
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
  return change(dispatch, {
    placements: [{ panel: "None", side }],
    cabinetCount,
    record: { [side]: "none", ...(remainingSideStatus !== "active" ? { panels: "None" } : {}) },
  });
}

/**
 * System auto-removes SP when OS/OSS cabinet appears at edge.
 * Will auto-restore when edge becomes eligible again (SB/SC).
 */
export async function autoRemoveSide(dispatch: AppDispatch, side: SidePanelSide, cabinetCount?: number) {
  return change(dispatch, { placements: [{ panel: "None", side }], cabinetCount, record: { [side]: "auto-removed" } });
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
  return change(dispatch, { placements: [{ panel: groove, side }], cabinetCount, record: { [side]: "active" } });
}

/**
 * Initial SP setup from preset or cabinet builder boot.
 * Sets groove + both sides active.
 */
export async function bootBothSides(dispatch: AppDispatch, groove: GrooveType, cabinetCount?: number) {
  return change(dispatch, {
    placements: [{ panel: groove, side: "both" }],
    cabinetCount,
    record: { panels: groove, left: "active", right: "active" },
  });
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
  const activeSides = (["left", "right"] as const).filter((side) =>
    side === "left" ? leftStatus === "active" : rightStatus === "active",
  );

  return change(dispatch, {
    placements: activeSides.map((side) => ({ panel: groove, side })),
    cabinetCount,
    record: { ...Object.fromEntries(activeSides.map((side) => [side, nextStatus])), panels: groove },
  });
}

/**
 * Auto-remove both sides when total vanity width = 340cm.
 * Both sides marked "auto-removed" (will restore when width changes).
 */
export async function autoRemoveBoth(dispatch: AppDispatch, cabinetCount?: number) {
  return change(dispatch, {
    placements: [{ panel: "None", side: "both" }],
    cabinetCount,
    record: { panels: "None", left: "auto-removed", right: "auto-removed" },
  });
}

/**
 * Removes the panels of both sides without touching the recorded values, e.g. before the
 * composition is cleared or replaced; the caller records what the new composition gets.
 */
export async function clearSidePanels(dispatch: AppDispatch, cabinetCount?: number) {
  return change(dispatch, { placements: [{ panel: "None", side: "both" }], cabinetCount });
}

/**
 * Re-apply SP after preset switch in prebuilt mode.
 * Does NOT preserve previous per-side state — preset switch is a fresh start.
 * Puts SP on every eligible edge (SB/SC), skips ineligible edges (OS/OSS).
 */
export async function reapplySidePanelsForPreset(
  dispatch: AppDispatch,
  profile: ProductProfile | null,
  currentGroove: string,
  presetProducts: PresetSidePanelProduct[],
  cabinetCount?: number,
  productIds?: string[],
) {
  if (!currentGroove || currentGroove === "None" || !isGrooveType(currentGroove)) return;
  if (!presetProducts.length) return;
  // Without the collection's side panel data the new edges cannot be judged; keep the scene as it is.
  if (!selectRuleData(profile, "sidePanels")) return;

  const count = cabinetCount ?? presetProducts.length;
  const scopedProductIds = normalizeProductIds(productIds);
  const edges = getPresetEdges(presetProducts, scopedProductIds);
  const eligibleEdges = edges.filter(({ product }) => isSidePanelEligiblePresetEdge(product, profile));
  const eligible = eligibleEdges[0]?.product;

  // Always clear stale physical panels before mapping the saved groove onto the
  // new preset edges. A preset with shelf ends may have no side that can receive SP.
  const clearStale = { panel: "None", side: "both" } as const;

  if (!eligible) {
    return change(dispatch, {
      placements: [clearStale],
      cabinetCount: count,
      record: { ...presetEdgeStatuses(edges, new Set()), panels: currentGroove },
    });
  }

  const availability = sidePanelAvailabilityRule(
    {
      height: eligible.Height ?? null,
      handleType: mapSidePanelDrawersToHandleType(eligible.Drawers, profile),
      cabinetType: "SBSC",
    },
    profile,
  );

  const groove = resolveGroove(availability.allowed as Set<string>, currentGroove, eligible.Handle ?? null);

  if (groove === "None") {
    return change(dispatch, {
      placements: [clearStale],
      cabinetCount: count,
      record: { ...presetEdgeStatuses(edges, new Set()), panels: currentGroove },
    });
  }

  const activeSides = new Set(eligibleEdges.map(({ side }) => side));

  return change(dispatch, {
    placements: [clearStale, ...[...activeSides].map((side) => ({ panel: groove, side }))],
    cabinetCount: count,
    record: { ...presetEdgeStatuses(edges, activeSides), panels: groove },
  });
}

/**
 * Puts back the saved panels: the groove on every side that was active. `record` names the
 * values to record with them; an undo restores the state as a whole and records nothing.
 */
export async function restoreSidePanelState(
  dispatch: AppDispatch,
  spGroove: string | undefined,
  spLeft: string | undefined,
  spRight: string | undefined,
  cabinetCount?: number,
  record?: SidePanelChange["record"],
) {
  const left = spLeft ?? (spGroove && spGroove !== "None" ? "active" : "none");
  const right = spRight ?? (spGroove && spGroove !== "None" ? "active" : "none");
  const isSingleCabinet = cabinetCount === 1;
  const clearBoth = { panel: "None", side: "both" } as const;

  const placements =
    !spGroove || spGroove === "None"
      ? [clearBoth]
      : isSingleCabinet && left === "active" && right === "active"
        ? [{ panel: spGroove, side: "both" as const }]
        : [
            clearBoth,
            ...(left === "active" ? [{ panel: spGroove, side: "left" as const }] : []),
            ...(right === "active" ? [{ panel: spGroove, side: "right" as const }] : []),
          ];

  return change(dispatch, { placements, cabinetCount, record });
}
