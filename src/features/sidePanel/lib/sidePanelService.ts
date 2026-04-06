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
import { sidePanelAvailabilityRule } from "./sidePanelRules";

export type SidePanelSide = "left" | "right";
export type SidePanelStatus = "active" | "none" | "auto-removed";
export type GrooveType = "NoG" | "UpperG" | "CenterG" | "DoubleG" | "None";
const GROOVE_VALUES = ["NoG", "UpperG", "CenterG", "DoubleG", "None"] as const;

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

// ── Public API ──────────────────────────────────────────────────────────

/**
 * User selects groove type in Accessories UI.
 * Updates PlayCanvas + Redux groove + per-side status.
 * @param side — which edge cabinet was selected ("both" for single cabinet)
 */
export async function applyGroove(
  dispatch: AppDispatch,
  groove: GrooveType,
  side: "left" | "right" | "both",
) {
  await setSidePanel(groove, side);
  dispatch(setSidePanelsOption(groove));
  dispatchSideStatus(dispatch, side, groove === "None" ? "none" : "active");
}

/**
 * User deletes SP entity via context menu in 3D player.
 * Clears PlayCanvas SP on that side, marks as user-removed (won't auto-restore).
 * Resets groove to "None" so UI shows no selection.
 */
export async function deleteSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
) {
  await setSidePanel("None", side);
  dispatch(setSidePanelSideStatus({ side, status: "none" }));
  dispatch(setSidePanelsOption("None"));
}

/**
 * System auto-removes SP when OS/OSS cabinet appears at edge.
 * Will auto-restore when edge becomes eligible again (SB/SC).
 */
export async function autoRemoveSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
) {
  await setSidePanel("None", side);
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
) {
  await setSidePanel(groove, side);
  dispatch(setSidePanelSideStatus({ side, status: "active" }));
}

/**
 * Initial SP setup from preset or cabinet builder boot.
 * Sets groove + both sides active.
 */
export async function bootBothSides(
  dispatch: AppDispatch,
  groove: GrooveType,
) {
  await setSidePanel(groove, "both");
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
) {
  if (leftStatus === "active") await setSidePanel(groove, "left");
  if (rightStatus === "active") await setSidePanel(groove, "right");
  dispatch(setSidePanelsOption(groove));
}

/**
 * Auto-remove both sides when total vanity width = 340cm.
 * Both sides marked "auto-removed" (will restore when width changes).
 */
export async function autoRemoveBoth(dispatch: AppDispatch) {
  await setSidePanel("None", "both");
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
  presetProducts: Array<{ name?: string; Handle?: string; Height?: number; Drawers?: string }>,
) {
  if (!currentGroove || currentGroove === "None") return;
  if (!presetProducts.length) return;

  const { mapCabinetTypeToGroup } = await import("../model/selectors");

  // Find first SP-eligible cabinet (SB/SC) for groove resolution
  const eligible = presetProducts.find((p) => {
    const group = mapCabinetTypeToGroup(p.name ?? null);
    return group === "SBSC";
  });
  if (!eligible) return;

  const mapDrawers = (d?: string | null) => {
    if (!d) return null;
    if (d === "1D" || d === "1DWID" || d === "1" || d === "1+inner") return "1D" as const;
    if (d === "2D" || d === "2") return "2D" as const;
    return null;
  };

  const availability = sidePanelAvailabilityRule({
    height: eligible.Height ?? null,
    handleType: mapDrawers(eligible.Drawers),
    cabinetType: "SBSC",
  });

  const groove = resolveGroove(
    availability.allowed as Set<string>,
    currentGroove,
    eligible.Handle ?? null,
  );

  if (groove === "None") return;

  // Check edge cabinets — OS/OSS on edge → no SP on that side
  const leftGroup = mapCabinetTypeToGroup(presetProducts[0].name ?? null);
  const rightGroup = mapCabinetTypeToGroup(presetProducts[presetProducts.length - 1].name ?? null);
  const leftEligible = leftGroup !== "OS" && leftGroup !== "OSS";
  const rightEligible = rightGroup !== "OS" && rightGroup !== "OSS";

  await setSidePanel("None", "both");

  if (leftEligible) {
    await setSidePanel(groove, "left");
    dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
  } else {
    dispatch(setSidePanelSideStatus({ side: "left", status: "none" }));
  }

  if (rightEligible) {
    await setSidePanel(groove, "right");
    dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));
  } else {
    dispatch(setSidePanelSideStatus({ side: "right", status: "none" }));
  }

  dispatch(setSidePanelsOption(groove));
}

export async function restoreSidePanelState(
  spGroove: string | undefined,
  spLeft: string | undefined,
  spRight: string | undefined,
) {
  const left = spLeft ?? (spGroove && spGroove !== "None" ? "active" : "none");
  const right = spRight ?? (spGroove && spGroove !== "None" ? "active" : "none");
  await setSidePanel("None", "both");
  if (spGroove && spGroove !== "None") {
    if (left === "active") await setSidePanel(spGroove, "left");
    if (right === "active") await setSidePanel(spGroove, "right");
  }
}
