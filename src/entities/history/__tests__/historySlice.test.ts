import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import type { RootState } from "@/app/store";
import { rootReducer } from "@/app/store/reducer";

import { getCanRedo, getCanUndo, getIsHistoryBlocked } from "../model/store/selectors";
import {
  clearHistory,
  pushSnapshot,
  redo,
  setHistoryBlocked,
  setHistoryRestoring,
  undo,
  type SceneSnapshot,
} from "../model/store/slice";

const setUp = () => {
  const store = configureStore({ reducer: rootReducer });
  const state = () => store.getState() as RootState;
  const { product } = state().rootStateUI;
  /** A snapshot of the empty builder, told apart by the ids it lists. */
  const snapshotOf = (...productIds: string[]): SceneSnapshot => ({
    productIds,
    productConfigs: {},
    productOptions: { ...product.productOptions },
    activeCabinetType: null,
    selectedDimensions: { ...product.selectedDimensions },
  });

  return { store, state, snapshotOf, history: () => state().rootStateUI.history };
};

describe("history: undo and redo wait for an open scene edit", () => {
  it("offers neither undo nor redo while an edit is open, and both again once it is closed", () => {
    const { store, state, snapshotOf } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));
    store.dispatch(pushSnapshot(snapshotOf("a", "b")));
    store.dispatch(undo(snapshotOf("a", "b", "c")));
    expect([getCanUndo(state()), getCanRedo(state())]).toEqual([true, true]);

    store.dispatch(setHistoryBlocked(true));
    expect([getCanUndo(state()), getCanRedo(state())]).toEqual([false, false]);

    store.dispatch(setHistoryBlocked(false));
    expect([getCanUndo(state()), getCanRedo(state())]).toEqual([true, true]);
  });

  it("keeps the entries untouched while it waits", () => {
    const { store, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));
    store.dispatch(undo(snapshotOf("a", "b")));
    const before = history();

    store.dispatch(setHistoryBlocked(true));

    expect(history().past).toBe(before.past);
    expect(history().future).toBe(before.future);
  });

  it("still knows an edit is open after the history is cleared", () => {
    const { store, state, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));
    store.dispatch(setHistoryBlocked(true));

    store.dispatch(clearHistory());

    expect(history().past).toEqual([]);
    expect(getIsHistoryBlocked(state())).toBe(true);
  });
});

describe("history: entries", () => {
  it("drops redo when a new entry is written", () => {
    const { store, state, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));
    store.dispatch(undo(snapshotOf("a", "b")));
    expect(getCanRedo(state())).toBe(true);

    store.dispatch(pushSnapshot(snapshotOf("c")));

    expect(history().future).toEqual([]);
    expect(history().past.map(({ productIds }) => productIds)).toEqual([["c"]]);
  });

  it("moves the current state to the other list on undo and on redo", () => {
    const { store, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));

    store.dispatch(undo(snapshotOf("a", "b")));
    expect(history().past).toEqual([]);
    expect(history().future.map(({ productIds }) => productIds)).toEqual([["a", "b"]]);

    store.dispatch(redo(snapshotOf("a")));
    expect(history().future).toEqual([]);
    expect(history().past.map(({ productIds }) => productIds)).toEqual([["a"]]);
  });

  it("starts over from an empty composition, which cannot be restored, so the first cabinet cannot be undone", () => {
    const { store, state, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));
    store.dispatch(undo(snapshotOf("a", "b")));

    store.dispatch(pushSnapshot(snapshotOf()));

    expect(history().past).toEqual([]);
    expect(history().future).toEqual([]);
    expect([getCanUndo(state()), getCanRedo(state())]).toEqual([false, false]);
  });

  it("keeps an empty composition out of redo when the last cabinet's removal is undone", () => {
    const { store, state, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));

    // The current state is the scene emptied by the removal.
    store.dispatch(undo(snapshotOf()));

    expect(history().past).toEqual([]);
    expect(history().future).toEqual([]);
    expect(getCanRedo(state())).toBe(false);
  });

  it("keeps an empty composition out of undo when a redo leaves it", () => {
    const { store, snapshotOf, history } = setUp();
    store.dispatch(pushSnapshot(snapshotOf("a")));
    store.dispatch(undo(snapshotOf("a", "b")));

    store.dispatch(redo(snapshotOf()));

    expect(history().past).toEqual([]);
    expect(history().future).toEqual([]);
  });

  it("writes no entry while a snapshot is being restored", () => {
    const { store, snapshotOf, history } = setUp();
    store.dispatch(setHistoryRestoring(true));

    store.dispatch(pushSnapshot(snapshotOf("a")));

    expect(history().past).toEqual([]);
  });
});
