import { useMemo, useRef } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";

import { getIsHistoryRestoring } from "../model/store/selectors";
import { pushSnapshot, type SceneSnapshot } from "../model/store/slice";
import { captureSnapshot } from "./captureSnapshot";

/**
 * A history entry for an edit that is only known to have happened when it ends.
 *
 * A dragged cabinet or countertop can still be cancelled, and the scene cannot describe itself
 * while the edit is open. So the state is read when the edit starts and written to the history
 * when it is applied. An edit that is cancelled leaves the history as it was.
 */
export type DeferredHistorySnapshot = {
  /** Reads the state as it is now, before the edit `owner` starts. */
  capture(owner: string): Promise<void>;
  /** The edit was applied: its starting state becomes one history entry. Later calls do nothing. */
  commit(owner: string): void;
  /** The edit was cancelled or never started. */
  discard(owner: string): void;
};

type Pending = {
  snapshot: SceneSnapshot;
  /** The history lists at capture time: an entry written since then makes this one out of date. */
  past: readonly SceneSnapshot[];
  future: readonly SceneSnapshot[];
};

export function useDeferredHistorySnapshot(): DeferredHistorySnapshot {
  const store = useStore<RootState>();
  const pendingRef = useRef(new Map<string, Pending>());
  const latestRef = useRef(new Map<string, symbol>());

  return useMemo(() => {
    const pending = pendingRef.current;
    const latest = latestRef.current;
    const history = () => store.getState().rootStateUI.history;

    return {
      async capture(owner) {
        const token = Symbol(owner);
        latest.set(owner, token);
        pending.delete(owner);
        if (getIsHistoryRestoring(store.getState())) return;

        const { past, future } = history();
        try {
          const snapshot = await captureSnapshot(() => store.getState());
          // A newer capture or a discard of the same edit wins over this read.
          if (latest.get(owner) === token) pending.set(owner, { snapshot, past, future });
        } catch (error) {
          console.error("[History] Failed to capture snapshot", error);
        }
      },
      commit(owner) {
        const entry = pending.get(owner);
        pending.delete(owner);
        latest.delete(owner);
        if (!entry) return;

        const { past, future } = history();
        if (past !== entry.past || future !== entry.future) return;
        store.dispatch(pushSnapshot(entry.snapshot));
      },
      discard(owner) {
        pending.delete(owner);
        latest.delete(owner);
      },
    };
  }, [store]);
}
