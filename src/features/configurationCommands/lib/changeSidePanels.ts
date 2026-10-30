import type { UnknownAction } from "@reduxjs/toolkit";

import { markRuntimeOutOfSync } from "@/entities/configuration";
import type { ConfigurationSidePanelPort, SidePanelPlacement } from "@/entities/configuration";
import { createSidePanelPort } from "@/features/playCanvasAdapter/lib/createSidePanelPort";

import { commitPlan, type CommitContext } from "./commitChange";
import type { PlannedChange } from "../model/types";

/**
 * Places the side panels of the composition and records them (C06).
 *
 * The side panel rules decide which panel goes on which side; this command is the one path to
 * the scene and to the state for them. The panels reach the scene through I's side panel port,
 * then the groove and the per-side statuses are recorded once, only when the scene took them.
 */

export type SidePanelStatus = "active" | "none" | "auto-removed";

export type SidePanelChange = {
  /** Panels to place, in order. Empty when only the recorded values change. */
  placements: readonly SidePanelPlacement[];
  /** Number of cabinets: a single cabinet is both edges. */
  cabinetCount?: number;
  /** Values recorded once the scene took the placements. A value left out stays as it is. */
  record?: { panels?: string; left?: SidePanelStatus; right?: SidePanelStatus };
};

export type SidePanelChangeResult =
  | { status: "applied" }
  | { status: "partial"; message: string; needsSync: true }
  | { status: "error"; code: "runtime-not-ready" | "runtime-failed"; message: string };

export type ChangeSidePanelsDeps = {
  dispatch: (action: UnknownAction) => unknown;
  /** Tests pass a stand-in; the app places the panels through the PlayCanvas adapter. */
  port?: ConfigurationSidePanelPort;
};

/** The side panel values are configuration-wide and need nothing of the state to be recorded. */
const COMMIT_CONTEXT: CommitContext = { selectedProductConfig: null, resolveRuntimeId: () => null, profile: null };

const toChanges = ({ panels, left, right }: NonNullable<SidePanelChange["record"]>): PlannedChange[] => {
  const values: [string, string | undefined][] = [
    ["SidePanelLeft", left],
    ["SidePanelRight", right],
    ["SidePanels", panels],
  ];

  return values.flatMap(([attributeId, value]) =>
    value === undefined
      ? []
      : [{ attributeId, target: { scope: "global" as const }, value, origin: "requested" as const }],
  );
};

export const changeSidePanels = async (
  { placements, cabinetCount, record }: SidePanelChange,
  { dispatch, port = createSidePanelPort() }: ChangeSidePanelsDeps,
): Promise<SidePanelChangeResult> => {
  const result = await port.apply(placements, cabinetCount);

  // Nothing reached the scene: nothing is recorded.
  if (result.status === "not-ready") {
    return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet." };
  }

  if (result.status === "failed") {
    return { status: "error", code: "runtime-failed", message: result.message };
  }

  if (record) {
    for (const action of commitPlan(toChanges(record), COMMIT_CONTEXT)) dispatch(action);
  }

  if (result.status === "partial") {
    dispatch(markRuntimeOutOfSync());
    return { status: "partial", message: result.message, needsSync: true };
  }

  return { status: "applied" };
};
