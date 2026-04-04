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

export type SidePanelSide = "left" | "right";
export type SidePanelStatus = "active" | "none" | "auto-removed";
export type GrooveType = "NoG" | "UpperG" | "CenterG" | "DoubleG" | "None";

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
