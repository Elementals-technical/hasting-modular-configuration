// @vitest-environment jsdom
/**
 * Controller tests with a mocked DividerRuntimeAdapter and a minimal redux store.
 * Every case below is a regression guard for a real production bug (plan §T6).
 */
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DividerAvailability,
  DividerCommand,
  DividerContext,
  DividerSlot,
  DividerType,
} from "../../model/types";
import { DIVIDER_SLOT_MISMATCH_WARNING } from "../../model/validate";
import type { DividerContextChangeListener, DividerRuntimeAdapter } from "../../adapter";
import { useDividerController } from "../useDividerController";

// ── Minimal redux store (only the state path the controller reads) ─────────────

const SET_TYPE = "test/setSelectedDividerType";

type TestProductState = { selectedDividerType: DividerType | null };

const productReducer = (
  state: TestProductState = { selectedDividerType: null },
  action: { type: string; payload?: unknown },
): TestProductState =>
  action.type === SET_TYPE
    ? { ...state, selectedDividerType: action.payload as DividerType | null }
    : state;

const createTestStore = (initialType: DividerType | null = null) =>
  configureStore({
    reducer: { rootStateUI: combineReducers({ product: productReducer }) },
    preloadedState: { rootStateUI: { product: { selectedDividerType: initialType } } },
  });

type TestStore = ReturnType<typeof createTestStore>;

const setSelectedType = (store: TestStore, type: DividerType | null) =>
  act(() => {
    store.dispatch({ type: SET_TYPE, payload: type });
  });

// ── Mock adapter ────────────────────────────────────────────────────────────────

const CONTEXT: DividerContext = { cabinetId: "cab-1", drawerType: "Bot" };

const createMockAdapter = () => {
  const slotListeners = new Set<(slot: DividerSlot) => void | Promise<void>>();
  const contextListeners = new Set<DividerContextChangeListener>();
  const executed: DividerCommand[] = [];
  let availabilityTypes: DividerType[] | null = ["A", "B", "C"];
  let placeGate: Promise<boolean> | null = null;

  const onSlotClick = vi.fn((listener: (slot: DividerSlot) => void) => {
    slotListeners.add(listener);
    return () => {
      slotListeners.delete(listener);
    };
  });

  const onActiveContextChange = vi.fn((listener: DividerContextChangeListener) => {
    contextListeners.add(listener);
    return () => {
      contextListeners.delete(listener);
    };
  });

  const execute = vi.fn(async (command: DividerCommand): Promise<boolean> => {
    executed.push(command);
    if (command.kind === "place" && placeGate) return placeGate;
    return true;
  });

  const fetchAvailability = vi.fn(async (context: DividerContext): Promise<DividerAvailability | null> =>
    availabilityTypes
      ? // Always FRESH object + fresh array — value-equality is part of what we test.
        { context, types: [...availabilityTypes], fetchedAt: Date.now() }
      : null,
  );

  const adapter: DividerRuntimeAdapter = {
    isReady: () => true,
    resolveActiveContext: () => CONTEXT,
    execute,
    fetchAvailability,
    fetchPlaced: vi.fn(async () => []),
    fetchSlotTypes: vi.fn(() => availabilityTypes ?? []),
    setSlotButtonsVisible: vi.fn(),
    restoreTopView: vi.fn(async () => true),
    onSlotClick,
    onActiveContextChange,
  };

  return {
    adapter,
    executed,
    execute,
    onSlotClick,
    fetchAvailability,
    placedCommands: () => executed.filter((command) => command.kind === "place"),
    emitSlot: async (slot: DividerSlot) => {
      await act(async () => {
        for (const listener of [...slotListeners]) {
          await listener(slot);
        }
      });
    },
    /** Fire a slot click WITHOUT awaiting completion (for in-flight scenarios). */
    emitSlotNoWait: (slot: DividerSlot) => {
      const pending: Array<void | Promise<void>> = [];
      for (const listener of [...slotListeners]) {
        pending.push(listener(slot));
      }
      return Promise.all(pending);
    },
    setAvailabilityTypes: (types: DividerType[] | null) => {
      availabilityTypes = types;
    },
    setPlaceGate: (gate: Promise<boolean> | null) => {
      placeGate = gate;
    },
  };
};

type MockAdapter = ReturnType<typeof createMockAdapter>;

// ── Slot builders ───────────────────────────────────────────────────────────────

const candidateSlot = (placementType: DividerType, overrides: Partial<DividerSlot> = {}): DividerSlot => ({
  context: CONTEXT,
  zone: "main",
  key: `candidate:Bot:main:left:0:${placementType}`,
  kind: "candidate",
  placementType,
  occupiedType: null,
  stateId: null,
  availableTypes: ["A", "B", "C"],
  canPlace: true,
  disabledReason: null,
  position: { start: 0, center: 6.75, end: 13.5 },
  zoneIndex: 0,
  ...overrides,
});

const occupiedSlot = (occupiedType: DividerType): DividerSlot => ({
  context: CONTEXT,
  zone: "main",
  key: "occupied:Bot:main:1",
  kind: "occupied",
  placementType: null,
  occupiedType,
  stateId: "state-42",
  availableTypes: [],
  canPlace: false,
  disabledReason: null,
  position: { start: 0, center: 6.75, end: 13.5 },
  zoneIndex: 1,
});

// ── Harness ─────────────────────────────────────────────────────────────────────

const mockOptions = [
  { id: 5000, title: "Option A", isShortDesc: false },
  { id: 5001, title: "Option B", isShortDesc: false },
  { id: 5002, title: "Option C", isShortDesc: false },
];

const mountController = async (
  mock: MockAdapter,
  store: TestStore,
  saveSnapshot: () => Promise<void> = async () => {},
) => {
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

  const utils = renderHook(
    () =>
      useDividerController({
        isPlayCanvasReady: true,
        dividerSelection: "Customize",
        optionsSource: mockOptions,
        saveSnapshot,
        fallbackCabinetId: CONTEXT.cabinetId,
        adapter: mock.adapter,
      }),
    { wrapper },
  );

  // Flush mount effects (gate showSlots + initial availability fetch).
  await act(async () => {});

  return utils;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Cases ───────────────────────────────────────────────────────────────────────

describe("useDividerController", () => {
  it("CASE 1: registers onSlotClick exactly once; selectedType changes do NOT re-register", async () => {
    const mock = createMockAdapter();
    const store = createTestStore("A");

    await mountController(mock, store);
    expect(mock.onSlotClick).toHaveBeenCalledTimes(1);
    expect(mock.adapter.onActiveContextChange).toHaveBeenCalledTimes(1);

    setSelectedType(store, "B");
    await act(async () => {});
    setSelectedType(store, "C");
    await act(async () => {});

    // The registration effect must not depend on selectedType (stale-closure root cause).
    expect(mock.onSlotClick).toHaveBeenCalledTimes(1);
    expect(mock.adapter.onActiveContextChange).toHaveBeenCalledTimes(1);
  });

  it("CASE 2: no stale closure — dispatcher reads the CURRENT type from the store without remount", async () => {
    const mock = createMockAdapter();
    const store = createTestStore("A");

    await mountController(mock, store);

    await mock.emitSlot(candidateSlot("A"));
    let places = mock.placedCommands();
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ kind: "place", type: "A" });

    // Change the selection WITHOUT remounting the hook — the regression scenario
    // where "B" kept flying into the payload regardless of the UI selection.
    setSelectedType(store, "C");
    await act(async () => {});

    await mock.emitSlot(candidateSlot("C"));
    places = mock.placedCommands();
    expect(places).toHaveLength(2);
    expect(places[1]).toMatchObject({ kind: "place", type: "C" });
  });

  it("CASE 3: mismatch — selected B on an A-candidate is rejected with the slot-mismatch warning", async () => {
    const mock = createMockAdapter();
    const store = createTestStore("B");

    const { result } = await mountController(mock, store);

    await mock.emitSlot(candidateSlot("A"));

    expect(mock.placedCommands()).toHaveLength(0);
    expect(result.current.warning).toBe(DIVIDER_SLOT_MISMATCH_WARNING);
  });

  it("CASE 4: remove does not reset the type — settle shows slots with the CURRENT selection", async () => {
    const mock = createMockAdapter();
    const store = createTestStore("C");

    await mountController(mock, store);
    mock.executed.length = 0; // ignore mount-time showSlots

    await mock.emitSlot(occupiedSlot("B"));

    const removeIndex = mock.executed.findIndex((command) => command.kind === "remove");
    expect(removeIndex).toBeGreaterThanOrEqual(0);

    const showAfterRemove = mock.executed
      .slice(removeIndex + 1)
      .find((command) => command.kind === "showSlots");
    expect(showAfterRemove).toMatchObject({
      kind: "showSlots",
      selectedType: "C", // NOT null and NOT the removed divider's type
      context: CONTEXT,
    });
  });

  it("CASE 5: anti-double-click — second place is ignored while the first is in flight", async () => {
    const mock = createMockAdapter();
    const store = createTestStore("A");

    await mountController(mock, store);

    let resolvePlace: (value: boolean) => void = () => {};
    mock.setPlaceGate(
      new Promise<boolean>((resolve) => {
        resolvePlace = resolve;
      }),
    );

    // First click: stops at the gated place command.
    const firstClick = mock.emitSlotNoWait(candidateSlot("A"));
    // Second click while the first place has not resolved yet.
    const secondClick = mock.emitSlotNoWait(candidateSlot("A"));

    await act(async () => {
      await secondClick;
    });
    expect(mock.placedCommands()).toHaveLength(1);

    mock.setPlaceGate(null);
    await act(async () => {
      resolvePlace(true);
      await firstClick;
    });

    // Still exactly one place command after everything settles.
    expect(mock.placedCommands()).toHaveLength(1);
  });

  it("CASE 6: availability value-equality — fresh-but-equal arrays do not produce a new state object", async () => {
    const mock = createMockAdapter();
    const store = createTestStore("A");
    mock.setAvailabilityTypes(["A", "B"]);

    const { result } = await mountController(mock, store);

    const firstAvailability = result.current.state.availability;
    expect(firstAvailability?.types).toEqual(["A", "B"]);
    const fetchCallsBefore = mock.fetchAvailability.mock.calls.length;

    // Second fetch returns a NEW object with a NEW array of the same values.
    await act(async () => {
      result.current.refresh();
    });

    expect(mock.fetchAvailability.mock.calls.length).toBeGreaterThan(fetchCallsBefore);
    expect(result.current.state.availability).toBe(firstAvailability);

    // Different values DO update the state.
    mock.setAvailabilityTypes(["A"]);
    await act(async () => {
      result.current.refresh();
    });
    expect(result.current.state.availability).not.toBe(firstAvailability);
    expect(result.current.state.availability?.types).toEqual(["A"]);
  });
});
