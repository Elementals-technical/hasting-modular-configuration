// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { store } from "@/app/store";
import { ReadyCollectionContext } from "@/entities/collection";
import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { resetConfiguration, type SceneRestoreResult } from "@/entities/configuration";
import { NO_DIFFERENCE, type HistoryMovePlan, type OrganizersMovePlan } from "@/entities/history/lib/planHistoryMove";
import type { OrganizerHistoryPort, RestoreOrganizersOnlyResult } from "@/entities/history/lib/restoreOrganizersOnly";
import {
  clearHistory,
  pushSnapshot,
  setHistoryBlocked,
  setHistoryRestoring,
  undo,
  type SceneSnapshot,
} from "@/entities/history/model/store/slice";
import { reset, resetProducts, setActiveProfile } from "@/entities/product/model/store/slice";
import { classProfile } from "@/features/drawerOrganizers/__tests__/organizerHookSetup";
import { classCollection } from "@/features/drawerOrganizers/__tests__/organizerUiSetup";
import { selectOrganizersEnabled } from "@/features/drawerOrganizers/model/store/selectors";
import { setView } from "@/features/drawerOrganizers/model/store/slice";

import { useHistoryMove, type UseHistoryMoveDeps } from "../lib/useHistoryMove";

/** Class offers drawer organizers; its collection context also serves the USH tests (the gate is the profile). */
const CLASS_COLLECTION = classCollection();

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReadyCollectionContext.Provider value={CLASS_COLLECTION}>
    <Provider store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  </ReadyCollectionContext.Provider>
);

/** A history entry. The hook never reads into one, so `label` only tells them apart in the assertions. */
const snapshotNamed = (label: string): SceneSnapshot => ({
  productIds: ["rt-1"],
  productConfigs: { "rt-1": { label } },
  productOptions: {} as SceneSnapshot["productOptions"],
  activeCabinetType: null,
  selectedDimensions: { width: null, height: null, depth: null },
});

const ORGANIZERS_PLAN: OrganizersMovePlan = {
  kind: "organizers",
  writes: [{ stableKey: "cab-1", runtimeId: "rt-1", state: null, drawers: ["Bot"] }],
  values: null,
  productOptions: null,
};
const REBUILT: SceneRestoreResult = { status: "restored", matches: [], scene: { status: "not-ready" } };
const APPLIED: RestoreOrganizersOnlyResult = { status: "applied" };
const VIEW = { cabinetKey: "cab-1", drawer: "Top" } as const;

const history = () => store.getState().rootStateUI.history;
const labelOf = (snapshot: SceneSnapshot | undefined) => snapshot?.productConfigs["rt-1"]?.label;

/**
 * The hook with every dependency a stand-in: the fast path applies, the full path rebuilds. `calls` lists, in
 * order, the waits and captures, so a test can tell what ran before what.
 */
const setUp = (overrides: Partial<UseHistoryMoveDeps> = {}) => {
  const calls: string[] = [];
  const current = snapshotNamed("current");
  const port: OrganizerHistoryPort = {
    isReady: () => true,
    apply: vi.fn(),
    preview: vi.fn(),
    whenSettled: vi.fn(async () => {
      calls.push("whenSettled");
    }),
    enterView: vi.fn(async () => true),
  };
  const deps = {
    capture: vi.fn(async () => {
      calls.push("capture");
      return current;
    }),
    restore: vi.fn(async () => REBUILT),
    plan: vi.fn((): HistoryMovePlan => ORGANIZERS_PLAN),
    restoreOrganizers: vi.fn(async () => APPLIED),
    port,
    camera: { capture: vi.fn(() => null), restore: vi.fn() },
    isDebug: () => false,
    ...overrides,
  };
  const hook = renderHook(() => useHistoryMove(deps), { wrapper });
  const moveHistory = (direction: "undo" | "redo") => act(() => hook.result.current.moveHistory(direction));
  return { deps, port, current, calls, hook, moveHistory };
};

describe("useHistoryMove", () => {
  beforeEach(() => {
    store.dispatch(reset());
    // Also drops the drawer in view the organizers UI kept from the previous test.
    store.dispatch(resetProducts());
    store.dispatch(resetConfiguration());
    store.dispatch(setActiveProfile(classProfile));
    store.dispatch(setHistoryRestoring(false));
    store.dispatch(setHistoryBlocked(false));
    store.dispatch(clearHistory());
    // past: [first, second]; undo goes to "second".
    store.dispatch(pushSnapshot(snapshotNamed("first")));
    store.dispatch(pushSnapshot(snapshotNamed("second")));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fast path (organizers only)", () => {
    it("puts the organizers back and moves the history, without a rebuild, the camera or closing the drawer", async () => {
      store.dispatch(setView(VIEW));
      let restoringDuringMove: boolean | undefined;
      const { deps, port, current, calls, moveHistory } = setUp({
        restoreOrganizers: vi.fn(async () => {
          restoringDuringMove = history().isRestoring;
          return APPLIED;
        }),
      });

      await moveHistory("undo");

      expect(calls).toEqual(["whenSettled", "capture"]);
      expect(deps.plan).toHaveBeenCalledWith(
        current,
        expect.objectContaining({ productConfigs: { "rt-1": { label: "second" } } }),
      );
      expect(deps.restoreOrganizers).toHaveBeenCalledWith(ORGANIZERS_PLAN, expect.objectContaining({ port }));
      expect(deps.restore).not.toHaveBeenCalled();
      expect(deps.camera.capture).not.toHaveBeenCalled();
      expect(deps.camera.restore).not.toHaveBeenCalled();
      expect(store.getState().rootStateUI.drawerOrganizersUi.view).toEqual(VIEW);
      expect(history().past.map(labelOf)).toEqual(["first"]);
      expect(history().future.map(labelOf)).toEqual(["current"]);
      expect(restoringDuringMove).toBe(true);
      expect(history().isRestoring).toBe(false);
    });

    it("moves a redo the other way", async () => {
      store.dispatch(undo(snapshotNamed("next")));
      const { deps, moveHistory } = setUp();

      await moveHistory("redo");

      expect(deps.plan).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ productConfigs: { "rt-1": { label: "next" } } }),
      );
      expect(deps.restore).not.toHaveBeenCalled();
      expect(history().past.map(labelOf)).toEqual(["first", "current"]);
      expect(history().future).toEqual([]);
    });
  });

  describe("full path", () => {
    it("rebuilds from the same target and moves the history with the same current when the fast path falls back", async () => {
      const { deps, current, moveHistory } = setUp({
        restoreOrganizers: vi.fn(
          async (): Promise<RestoreOrganizersOnlyResult> => ({
            status: "fallback",
            reason: "setState rejected: X: y",
          }),
        ),
      });

      await moveHistory("undo");

      const planTarget = vi.mocked(deps.plan).mock.calls[0][1];
      expect(deps.restore).toHaveBeenCalledTimes(1);
      expect(vi.mocked(deps.restore).mock.calls[0][0]).toBe(planTarget);
      expect(deps.capture).toHaveBeenCalledTimes(1);
      expect(history().future).toEqual([current]);
      expect(deps.camera.capture).toHaveBeenCalledTimes(1);
      expect(deps.camera.restore).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        "[History] fast path fell back to a rebuild",
        "setState rejected: X: y",
      );
    });

    it("rebuilds without the fast path when the planner finds more than organizers", async () => {
      const { deps, moveHistory } = setUp({
        plan: vi.fn((): HistoryMovePlan => ({ kind: "full", reason: "products" })),
      });

      await moveHistory("undo");

      expect(deps.restoreOrganizers).not.toHaveBeenCalled();
      expect(deps.restore).toHaveBeenCalledTimes(1);
      expect(history().past.map(labelOf)).toEqual(["first"]);
    });

    it("in a collection without organizers (USH), neither waits for nor plans the move", async () => {
      store.dispatch(setActiveProfile(ushProfile));
      expect(selectOrganizersEnabled(store.getState())).toBe(false);
      const { deps, port, calls, moveHistory } = setUp();

      await moveHistory("undo");

      expect(port.whenSettled).not.toHaveBeenCalled();
      expect(deps.plan).not.toHaveBeenCalled();
      expect(deps.restoreOrganizers).not.toHaveBeenCalled();
      expect(calls).toEqual(["capture"]);
      expect(deps.restore).toHaveBeenCalledTimes(1);
      expect(history().past.map(labelOf)).toEqual(["first"]);
    });

    it("leaves the history where it was when the scene was not rebuilt", async () => {
      const { moveHistory } = setUp({
        plan: vi.fn((): HistoryMovePlan => ({ kind: "full", reason: "products" })),
        restore: vi.fn(async (): Promise<SceneRestoreResult> => ({ status: "not-ready" })),
      });

      await moveHistory("undo");

      expect(history().past.map(labelOf)).toEqual(["first", "second"]);
      expect(history().isRestoring).toBe(false);
    });
  });

  it("ignores a second click while a move is running", async () => {
    let settle!: () => void;
    const settled = new Promise<void>((resolve) => (settle = resolve));
    const { deps, port, hook } = setUp();
    vi.mocked(port.whenSettled).mockImplementation(() => settled);

    // The first move waits for the scene; its `isRestoring` reaches the hook once this `act` ends.
    let firstMove!: Promise<void>;
    act(() => {
      firstMove = hook.result.current.moveHistory("undo");
    });
    expect(hook.result.current.isRestoring).toBe(true);

    await act(() => hook.result.current.moveHistory("undo"));
    await act(async () => {
      settle();
      await firstMove;
    });

    expect(deps.capture).toHaveBeenCalledTimes(1);
    expect(history().past.map(labelOf)).toEqual(["first"]);
    expect(hook.result.current.isRestoring).toBe(false);
  });

  describe("historyDebug", () => {
    it("captures again after the fast path and reports a state that does not read as the target", async () => {
      const plan = vi
        .fn<() => HistoryMovePlan>()
        .mockReturnValueOnce(ORGANIZERS_PLAN)
        .mockReturnValueOnce({ kind: "full", reason: "products" });
      const { deps, moveHistory } = setUp({ plan, isDebug: () => true });

      await moveHistory("undo");

      expect(deps.capture).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith("[History] fast path mismatch", { kind: "full", reason: "products" });
    });

    it("stays silent when the state reads as the target", async () => {
      const plan = vi
        .fn<() => HistoryMovePlan>()
        .mockReturnValueOnce(ORGANIZERS_PLAN)
        .mockReturnValueOnce({ kind: "full", reason: NO_DIFFERENCE });
      const { deps, moveHistory } = setUp({ plan, isDebug: () => true });

      await moveHistory("undo");

      expect(deps.capture).toHaveBeenCalledTimes(2);
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
