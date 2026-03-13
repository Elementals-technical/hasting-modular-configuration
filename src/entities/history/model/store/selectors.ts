import type { RootState } from "@/app/store";

export const getCanUndo = (state: RootState) => state.rootStateUI.history.past.length > 0;
export const getCanRedo = (state: RootState) => state.rootStateUI.history.future.length > 0;
export const getIsHistoryRestoring = (state: RootState) => state.rootStateUI.history.isRestoring;
export const getLastPastSnapshot = (state: RootState) => {
  const { past } = state.rootStateUI.history;
  return past.length > 0 ? past[past.length - 1] : null;
};
export const getLastFutureSnapshot = (state: RootState) => {
  const { future } = state.rootStateUI.history;
  return future.length > 0 ? future[future.length - 1] : null;
};
