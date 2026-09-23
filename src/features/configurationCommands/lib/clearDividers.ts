import type { UnknownAction } from "@reduxjs/toolkit";

import { markRuntimeOutOfSync } from "@/entities/configuration";
import type { ConfigurationDividerPort } from "@/entities/configuration";
import { clearPlacedDividers } from "@/entities/product/model/store/slice";
import { createDividerPort } from "@/features/playCanvasAdapter";

/**
 * Removes the placed dividers of the composition (C06).
 *
 * Dividers reach the scene as drawer zone objects, so they have no value translation and the
 * runtime port cannot carry them: the divider port clears them and the recorded placements
 * follow only what the scene took, in the same shape as changeSidePanels.
 *
 * `DividersOption` is a value of its own and stays with the step that picked it; this command
 * owns the dividers, not the option.
 */

export type ClearDividersChange = {
  /** Products whose placed dividers are removed. */
  runtimeIds: readonly string[];
};

export type ClearDividersResult =
  | { status: "applied" }
  | { status: "partial"; message: string; needsSync: true }
  | { status: "error"; code: "runtime-not-ready" | "runtime-failed"; message: string };

export type ClearDividersDeps = {
  dispatch: (action: UnknownAction) => unknown;
  /** Tests pass a stand-in; the app clears them through the PlayCanvas adapter. */
  port?: ConfigurationDividerPort;
};

export const clearDividers = async (
  { runtimeIds }: ClearDividersChange,
  { dispatch, port = createDividerPort() }: ClearDividersDeps,
): Promise<ClearDividersResult> => {
  const result = await port.clear(runtimeIds);

  // Nothing reached the scene: nothing is recorded.
  if (result.status === "not-ready") {
    return { status: "error", code: "runtime-not-ready", message: "The scene is not ready yet." };
  }

  if (result.status === "failed") {
    return { status: "error", code: "runtime-failed", message: result.message };
  }

  dispatch(clearPlacedDividers());

  if (result.status === "partial") {
    dispatch(markRuntimeOutOfSync());
    return { status: "partial", message: result.message, needsSync: true };
  }

  return { status: "applied" };
};
