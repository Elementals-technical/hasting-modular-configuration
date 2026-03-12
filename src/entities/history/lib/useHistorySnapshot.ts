import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/store/redux";
import { store, type RootState } from "@/app/store";
import { captureSnapshot } from "./captureSnapshot";
import { pushSnapshot } from "../model/store/slice";
import { getIsHistoryRestoring } from "../model/store/selectors";

export function useHistorySnapshot() {
  const dispatch = useAppDispatch();
  const isHistoryRestoring = useAppSelector(getIsHistoryRestoring);

  const saveSnapshot = useCallback(async () => {
    if (isHistoryRestoring) return;

    try {
      const snapshot = await captureSnapshot(() => store.getState() as RootState);
      dispatch(pushSnapshot(snapshot));
    } catch (error) {
      console.error("[History] Failed to capture snapshot", error);
    }
  }, [dispatch, isHistoryRestoring]);

  return saveSnapshot;
}
