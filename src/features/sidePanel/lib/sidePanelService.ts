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

// ── Groove selection (user picks groove in Accessories UI) ─────────────

export async function applyGroove(
  dispatch: AppDispatch,
  groove: string,
  side: "left" | "right" | "both",
) {
  await setSidePanel(groove, side);
  dispatch(setSidePanelsOption(groove));

  if (groove === "None") {
    if (side === "both") {
      dispatch(setSidePanelSideStatus({ side: "left", status: "none" }));
      dispatch(setSidePanelSideStatus({ side: "right", status: "none" }));
    } else {
      dispatch(setSidePanelSideStatus({ side, status: "none" }));
    }
  } else {
    if (side === "both") {
      dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
      dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));
    } else {
      dispatch(setSidePanelSideStatus({ side, status: "active" }));
    }
  }
}

// ── Delete SP via context menu (user clicks Delete on SP entity) ───────

export async function deleteSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
) {
  await setSidePanel("None", side);
  dispatch(setSidePanelSideStatus({ side, status: "none" }));
  dispatch(setSidePanelsOption("None"));
}

// ── Auto-remove (OS/OSS at edge — system removes SP) ──────────────────

export async function autoRemoveSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
) {
  await setSidePanel("None", side);
  dispatch(setSidePanelSideStatus({ side, status: "auto-removed" }));
}

// ── Auto-restore (edge became SB/SC again — system restores SP) ────────

export async function autoRestoreSide(
  dispatch: AppDispatch,
  side: SidePanelSide,
  groove: string,
) {
  await setSidePanel(groove, side);
  dispatch(setSidePanelSideStatus({ side, status: "active" }));
}

// ── Boot (initial setup from preset/cabinet builder) ───────────────────

export async function bootBothSides(
  dispatch: AppDispatch,
  groove: string,
) {
  await setSidePanel(groove, "both");
  dispatch(setSidePanelsOption(groove));
  dispatch(setSidePanelSideStatus({ side: "left", status: "active" }));
  dispatch(setSidePanelSideStatus({ side: "right", status: "active" }));
}

// ── Apply groove only to active sides (middleware use) ──────────────────

export async function applyGrooveToActiveSides(
  dispatch: AppDispatch,
  groove: string,
  leftStatus: SidePanelStatus,
  rightStatus: SidePanelStatus,
) {
  if (leftStatus === "active") await setSidePanel(groove, "left");
  if (rightStatus === "active") await setSidePanel(groove, "right");
  dispatch(setSidePanelsOption(groove));
}

// ── Auto-remove both (340cm length blocker) ────────────────────────────

export async function autoRemoveBoth(dispatch: AppDispatch) {
  dispatch(setSidePanelsOption("None"));
  dispatch(setSidePanelSideStatus({ side: "left", status: "auto-removed" }));
  dispatch(setSidePanelSideStatus({ side: "right", status: "auto-removed" }));
  await setSidePanel("None", "both");
}
