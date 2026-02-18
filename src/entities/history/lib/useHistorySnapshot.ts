import { useCallback } from "react";
import { useAppDispatch } from "@/shared/hooks/store/redux";
import { store, type RootState } from "@/app/store";
import { captureSnapshot } from "./captureSnapshot";
import { pushSnapshot } from "../model/store/slice";

export function useHistorySnapshot() {
  const dispatch = useAppDispatch();

  const saveSnapshot = useCallback(async () => {
    try {
      const snapshot = await captureSnapshot(() => store.getState() as RootState);
      dispatch(pushSnapshot(snapshot));
    } catch (error) {
      console.error("[History] Failed to capture snapshot", error);
    }
  }, [dispatch]);

  return saveSnapshot;
}
