import type { SceneRestoreResult } from "@/entities/configuration";

import { getCanRedo, getCanUndo, getLastFutureSnapshot, getLastPastSnapshot } from "../model/store/selectors";
import { redo, setHistoryRestoring, undo } from "../model/store/slice";
import { captureSnapshot } from "./captureSnapshot";
import { restoreSnapshot, type RestoreSnapshotDeps } from "./restoreSnapshot";
import { runInHistoryOrder } from "./runInHistoryOrder";

export type HistoryDirection = "undo" | "redo";

export type MoveInHistoryDeps = RestoreSnapshotDeps & {
  /**
   * Runs once the state left behind was read, right before the scene is rebuilt: what still points at
   * the products being replaced (the selection, open panels) lets go of them.
   */
  beforeRebuild: () => void;
};

/** Whether the scene took the snapshot. History moves only when it did; a partial rebuild is reported. */
const isSceneRebuilt = (label: string, result: SceneRestoreResult): boolean => {
  if (result.status === "restored") return true;

  if (result.status === "partial") {
    console.error(`${label}: the scene was only partly rebuilt`, result.failed);
    return true;
  }

  console.error(`${label}: the scene was not rebuilt`, result);
  return false;
};

/**
 * An undo or a redo, in the history order: it runs once every action started before it is applied and
 * written, and takes the entry that is last at that moment. It rebuilds the scene from that entry and
 * moves the entry to the other list, as the state it leaves behind. Resolves whether the history moved.
 */
export const moveInHistory = (direction: HistoryDirection, deps: MoveInHistoryDeps): Promise<boolean> =>
  runInHistoryOrder(async () => {
    const { dispatch, getState, beforeRebuild } = deps;
    const label = direction === "undo" ? "[History] Undo" : "[History] Redo";
    const state = getState();
    const canMove = direction === "undo" ? getCanUndo(state) : getCanRedo(state);
    const snapshot = direction === "undo" ? getLastPastSnapshot(state) : getLastFutureSnapshot(state);
    if (!canMove || !snapshot) return false;

    dispatch(setHistoryRestoring(true));
    try {
      const current = await captureSnapshot(getState);
      beforeRebuild();
      const result = await restoreSnapshot(snapshot, deps);
      if (!isSceneRebuilt(label, result)) return false;

      dispatch(direction === "undo" ? undo(current) : redo(current));
      return true;
    } catch (error) {
      console.error(`${label} failed`, error);
      return false;
    } finally {
      dispatch(setHistoryRestoring(false));
    }
  });
