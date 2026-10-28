import { useMemo, useState } from "react";

import { store, type RootState } from "@/app/store";
import { useActiveCollection } from "@/entities/collection";
import type { SceneRestoreResult } from "@/entities/configuration";
import { captureSnapshot } from "@/entities/history/lib/captureSnapshot";
import { NO_DIFFERENCE, planHistoryMove } from "@/entities/history/lib/planHistoryMove";
import { restoreOrganizersOnly, type OrganizerHistoryPort } from "@/entities/history/lib/restoreOrganizersOnly";
import { restoreSnapshot } from "@/entities/history/lib/restoreSnapshot";
import { runInHistoryOrder } from "@/entities/history/lib/runInHistoryOrder";
import {
  getCanRedo,
  getCanUndo,
  getLastFutureSnapshot,
  getLastPastSnapshot,
} from "@/entities/history/model/store/selectors";
import { redo, setHistoryRestoring, undo, type SceneSnapshot } from "@/entities/history/model/store/slice";
import { setIsDrawerOpen, setSelectedSceneProduct } from "@/entities/product/model/store/slice";
import { useChangeAttribute, type ReplayValues } from "@/features/configurationCommands";
import { selectOrganizersEnabled } from "@/features/drawerOrganizers/model/store/selectors";
import { createOrganizerPort } from "@/features/playCanvasAdapter/lib/createOrganizerPort";
import { setOpenStyleSidebar } from "@/features/sidebar/model/store/slice";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { captureOrbitCameraState, restoreOrbitCameraState } from "@/utils/functions/playcanvas/orbitCamera";

/**
 * Undo and redo of the bottom canvas buttons (step B of the organizers history spec, §4.3).
 *
 * A move takes one of two paths, both from the same two snapshots (`current`, captured once, and the target):
 * - fast: in a collection with drawer organizers, a move that changed only the organizers (and the two options
 *   their panel owns) is put back on the products that stand in the scene (`restoreOrganizersOnly`);
 * - full: anything else, or a fast path that fell back, rebuilds the scene from the target snapshot, as the
 *   buttons always did.
 * The history moves one entry only when the scene took the move; a failed move leaves it where it was.
 */

export type HistoryMoveDirection = "undo" | "redo";

/** Every dependency has the app's default; tests pass stand-ins. */
export type UseHistoryMoveDeps = {
  capture?: typeof captureSnapshot;
  restore?: typeof restoreSnapshot;
  plan?: typeof planHistoryMove;
  restoreOrganizers?: typeof restoreOrganizersOnly;
  /** Default: the PlayCanvas organizer port. */
  port?: OrganizerHistoryPort;
  camera?: { capture: typeof captureOrbitCameraState; restore: typeof restoreOrbitCameraState };
  /** Whether to check the fast path's result against the target. Default: the URL has `historyDebug`. */
  isDebug?: () => boolean;
};

export type HistoryMove = {
  moveHistory: (direction: HistoryMoveDirection) => Promise<void>;
  /** A move is running: the buttons are disabled and another click does nothing. */
  isRestoring: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

const ORBIT_CAMERA = { capture: captureOrbitCameraState, restore: restoreOrbitCameraState };

const isHistoryDebugUrl = () => typeof window !== "undefined" && window.location.search.includes("historyDebug");

const getState = () => store.getState() as RootState;

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

export const useHistoryMove = ({
  capture = captureSnapshot,
  restore = restoreSnapshot,
  plan: planMove = planHistoryMove,
  restoreOrganizers = restoreOrganizersOnly,
  port: portOverride,
  camera = ORBIT_CAMERA,
  isDebug = isHistoryDebugUrl,
}: UseHistoryMoveDeps = {}): HistoryMove => {
  const dispatch = useAppDispatch();

  // For the buttons only: a move reads the history when its turn comes (`runInHistoryOrder`).
  const canUndo = useAppSelector(getCanUndo);
  const canRedo = useAppSelector(getCanRedo);

  const runtimeBindings = useActiveCollection((collection) => collection.catalog.runtimeBindings ?? null);
  const { replay } = useChangeAttribute();
  const port = useMemo(() => portOverride ?? createOrganizerPort(), [portOverride]);

  const [isRestoring, setIsRestoring] = useState(false);

  // Undo and redo restore the state as a whole, so the values are only shown on the scene again.
  // The outcome goes back to the restore, which reports an incomplete replay as a partial rebuild.
  const replaySnapshotValues = async (values: ReplayValues) => {
    const result = await replay({ send: values, record: false });
    if (result.status !== "applied" || result.skipped.length > 0) {
      console.warn("[History] The scene did not take every value of the snapshot", result);
    }
    return result;
  };

  /**
   * Dev check (`?historyDebug`): after the fast path the state must read as the target, so planning the same
   * move again finds nothing to change. Anything else means the fast path left the state and the target apart.
   */
  const checkFastPath = async (target: SceneSnapshot) => {
    const after = await capture(getState);
    const check = planMove(after, target);
    const matchesTarget = check.kind === "full" && check.reason === NO_DIFFERENCE;
    if (!matchesTarget) console.error("[History] fast path mismatch", check);
  };

  /**
   * The fast path. True when it put the target back and moved the history; false hands the same move to the
   * full path: the planner found more than organizers, or the scene did not take a product's state.
   */
  const moveOrganizersOnly = async (
    current: SceneSnapshot,
    target: SceneSnapshot,
    shiftHistory: typeof undo | typeof redo,
  ): Promise<boolean> => {
    const plan = planMove(current, target);
    if (plan.kind !== "organizers") {
      // Why this move rebuilds the scene: the first part the planner found to differ (or NO_DIFFERENCE).
      console.info("[History] rebuild:", plan.reason);
      return false;
    }

    const result = await restoreOrganizers(plan, { dispatch, getState, port });
    if (result.status !== "applied") {
      console.warn("[History] fast path fell back to a rebuild", result.reason);
      return false;
    }

    dispatch(shiftHistory(current));
    if (isDebug()) await checkFastPath(target);
    return true;
  };

  /** The full path, as before step B: the scene is rebuilt from the target snapshot. */
  const rebuildScene = async (
    current: SceneSnapshot,
    target: SceneSnapshot,
    shiftHistory: typeof undo | typeof redo,
    label: string,
  ) => {
    // Captured here rather than before `capture`: nothing moves the camera in between.
    const cameraState = camera.capture();
    dispatch(setOpenStyleSidebar(false));
    dispatch(setIsDrawerOpen(false));
    dispatch(setSelectedSceneProduct(""));
    const result = await restore(target, {
      dispatch,
      getState,
      getBindings: () => runtimeBindings,
      replay: replaySnapshotValues,
    });
    if (!isSceneRebuilt(label, result)) return;
    dispatch(shiftHistory(current));
    camera.restore(cameraState);
  };

  /**
   * One move, in the history order: it runs once every action started before it is applied and written,
   * and takes the entry that is last at that moment (not the one the buttons showed at the click).
   */
  const runMove = (direction: HistoryMoveDirection) =>
    runInHistoryOrder(async () => {
      const isUndo = direction === "undo";
      const state = getState();
      const target = isUndo ? getLastPastSnapshot(state) : getLastFutureSnapshot(state);
      const canMove = isUndo ? getCanUndo(state) : getCanRedo(state);
      if (!canMove || !target) return;

      const organizersEnabled = selectOrganizersEnabled(state);
      const label = isUndo ? "[History] Undo" : "[History] Redo";
      // Takes the target off its list and keeps `current` on the other one, for the way back.
      const shiftHistory = isUndo ? undo : redo;

      dispatch(setHistoryRestoring(true));
      try {
        // 1. Organizer commands still on their way finish first, so `current` holds what the scene holds.
        if (organizersEnabled) await port.whenSettled();
        const current = await capture(getState);

        // 2. A move of the organizers alone keeps the products in the scene.
        if (organizersEnabled && (await moveOrganizersOnly(current, target, shiftHistory))) return;

        // 3. Anything else rebuilds the scene.
        await rebuildScene(current, target, shiftHistory, label);
      } catch (error) {
        console.error(`${label} failed`, error);
      } finally {
        dispatch(setHistoryRestoring(false));
      }
    });

  const moveHistory = async (direction: HistoryMoveDirection) => {
    // A move is still running (a second click): the click does nothing.
    if (isRestoring) return;

    setIsRestoring(true);
    try {
      await runMove(direction);
    } finally {
      setIsRestoring(false);
    }
  };

  return { moveHistory, isRestoring, canUndo, canRedo };
};
