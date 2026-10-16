import type { RootState } from "@/app/store";
import { getRestoreState } from "@/entities/configuration";

export const getIsHistoryBlocked = (state: RootState) => state.rootStateUI.history.isBlocked;
export const getCanUndo = (state: RootState) =>
  state.rootStateUI.history.past.length > 0 && !state.rootStateUI.history.isBlocked;
export const getCanRedo = (state: RootState) =>
  state.rootStateUI.history.future.length > 0 && !state.rootStateUI.history.isBlocked;
export const getIsHistoryRestoring = (state: RootState) => state.rootStateUI.history.isRestoring;
/** A restore or an undo sets values in several steps; what sets a value on its own waits until it ends. */
export const getIsRestoreOrUndoRunning = (state: RootState) =>
  getRestoreState(state).status === "restoring" || getIsHistoryRestoring(state);
export const getLastPastSnapshot = (state: RootState) => {
  const { past } = state.rootStateUI.history;
  return past.length > 0 ? past[past.length - 1] : null;
};
export const getLastFutureSnapshot = (state: RootState) => {
  const { future } = state.rootStateUI.history;
  return future.length > 0 ? future[future.length - 1] : null;
};
