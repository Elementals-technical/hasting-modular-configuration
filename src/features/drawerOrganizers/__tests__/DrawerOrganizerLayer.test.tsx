// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDividersOption } from "@/entities/product/model/store/slice";
import type { OrganizersOverlayFrame } from "@/features/configuratorApi";
import { createTestOrganizerPort, type TestOrganizerPort } from "@/features/playCanvasAdapter";

import { organizerOverlayStore } from "../lib/organizerOverlayStore";
import {
  backToPresets,
  openEditor,
  recordDerived,
  selectColumn,
  setDraft,
  setSectionActive,
  showNotice,
} from "../model/store/slice";
import { DrawerOrganizerLayer } from "../ui/DrawerOrganizerLayer";
import framesFixture from "./fixtures/contract/frames.v1.json";
import { answerOf } from "./organizerPortAnswers";
import { createOrganizerTestStore, record, steps, ui, type OrganizerTestStore } from "./organizerHookSetup";
import { columnsEntry, withPage } from "./organizerUiSetup";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));

// The layer and its hooks make their own port; the test hands them the fake one.
const fakePort = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/features/playCanvasAdapter/lib/createOrganizerPort", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/playCanvasAdapter/lib/createOrganizerPort")>()),
  createOrganizerPort: () => fakePort.current,
}));

/**
 * The layer over the canvas against the fake port: what shows when, a tap on ⊕ and on a pill reaching the
 * port once, the Top | Bottom switch, and the notice with its undo hint and its timers.
 */

let store: OrganizerTestStore;
let fake: TestOrganizerPort;

const useFake = (next: TestOrganizerPort) => {
  fake = next;
  fakePort.current = next.port;
};

/** A frame of the shared fixture, for the product the test store calls `rt-1` (the fixture says `cab-1`). */
const frameOf = (name: string): OrganizersOverlayFrame => {
  const found = framesFixture.cases.find((testCase) => testCase.name === name);
  if (!found) throw new Error(`no frame case ${name}`);
  const frame = structuredClone(found.expected) as unknown as OrganizersOverlayFrame;
  if (frame.view) frame.view.productId = "rt-1";
  for (const entry of frame.entries) entry.productId = "rt-1";
  return frame;
};

const editableDrawer = (capacity: number) => ({
  exists: true,
  offered: true,
  role: "single" as const,
  profile: { id: "ROW-MTL-43", pitchM: 0.1, positionCount: 5, maxActive: 5, codec: "cells-v1" },
  maxSlot: 2,
  capacity,
  count: 0,
  lock: null,
  candidates: [],
  unavailable: null,
});

beforeEach(() => {
  store = createOrganizerTestStore();
  useFake(createTestOrganizerPort());
});

afterEach(() => {
  cleanup();
  organizerOverlayStore.set(null);
  vi.useRealTimers();
});

/** The layer mounted on Customize with the section open; the scene is ready. */
const renderLayer = ({ customize = true, sectionActive = true, ready = true } = {}) => {
  if (customize) store.dispatch(setDividersOption("Customize"));
  if (sectionActive) store.dispatch(setSectionActive(true));
  return render(<DrawerOrganizerLayer ready={ready} />, { wrapper: withPage(store) });
};

/** 3D tells the layer which drawer is in view and what to draw. */
const sceneShows = (frame: OrganizersOverlayFrame) =>
  act(() => {
    if (frame.view) fake.emit("view", { view: frame.view, reason: "command" });
    fake.emit("frame", frame);
  });

describe("DrawerOrganizerLayer: when it draws", () => {
  it("draws the frame while the section is open on Customize", async () => {
    renderLayer();
    await sceneShows(frameOf("in-view-empty"));
    expect(screen.getByRole("button", { name: "Add divider column" })).toBeTruthy();
  });

  it.each([
    ["the option is None", { customize: false }],
    ["the section is closed", { sectionActive: false }],
  ])("draws nothing when %s", async (_name, options) => {
    renderLayer(options);
    await sceneShows(frameOf("in-view-empty"));
    expect(screen.queryByTestId("organizer-overlay")).toBeNull();
  });

  it("draws on Customize also when the scene holds columns after a restore", async () => {
    record(store, "cab-1", columnsEntry({ Top: [{ slot: 0, positions: [2] }] }));
    renderLayer({ customize: false });
    await sceneShows(frameOf("in-view-empty"));
    expect(screen.getByTestId("organizer-overlay")).toBeTruthy();
  });

  it("subscribes to the scene only when it is ready", () => {
    renderLayer({ ready: false });
    expect(fake.listeners("frame")).toBe(0);
    cleanup();

    renderLayer({ ready: true });
    expect(fake.listeners("frame")).toBe(1);
  });
});

describe("DrawerOrganizerLayer: taps", () => {
  it("a tap on ⊕ adds the column once", async () => {
    useFake(createTestOrganizerPort({ answers: [answerOf("add-first")] }));
    renderLayer();
    await sceneShows(frameOf("in-view-empty"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add divider column" }));
    });

    expect(fake.commands()).toEqual([{ kind: "addColumn", runtimeId: "rt-1", drawer: "Top", slot: 0 }]);
    expect(steps(store)).toBe(1);
  });

  // A second tap while the first command runs is dropped by the editor's busy gate: useOrganizerEditor
  // "a double click runs one command" (it also taps ⊕ while busy).

  it("a tap on a column selects it, and the layer tells the overlay which one", async () => {
    record(
      store,
      "cab-1",
      columnsEntry({
        Top: [
          { slot: -2, positions: [3] },
          { slot: 2, positions: [] },
        ],
      }),
    );
    renderLayer();
    await sceneShows(frameOf("in-view-zone-full"));

    fireEvent.click(screen.getByRole("button", { name: "Divider column 2 of 2" }));

    expect(ui(store).selected).toEqual({ cabinetKey: "cab-1", drawer: "Top", slot: 2 });
    expect(screen.getByRole("button", { name: "Divider column 2 of 2" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("an Open Drawer pill enters the view of its cabinet's drawer, by runtime id", async () => {
    renderLayer();
    await sceneShows(frameOf("out-of-view"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open drawer, 1 column" }));
    });

    expect(fake.calls.filter(({ kind }) => kind === "enterView")).toEqual([
      { kind: "enterView", address: { runtimeId: "rt-1", drawer: "Bot" } },
    ]);
  });

  it("Close Drawer leaves the view", async () => {
    renderLayer();
    await sceneShows(frameOf("in-view-empty"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close Drawer" }));
    });

    expect(fake.calls.filter(({ kind }) => kind === "exitView")).toHaveLength(1);
  });
});

describe("DrawerOrganizerLayer: the draft of the editor", () => {
  const COLUMN_2 = { cabinetKey: "cab-1", drawer: "Top" as const, slot: 2 };
  const litCells = () =>
    [...screen.getByTestId("organizer-overlay").querySelectorAll("polygon[data-draft-cell]")].map((polygon) =>
      polygon.getAttribute("data-draft-cell"),
    );

  it("tints the cells of the draft on the selected column while the editor is open, and only then", async () => {
    record(
      store,
      "cab-1",
      columnsEntry({
        Top: [
          { slot: -2, positions: [3] },
          { slot: 2, positions: [] },
        ],
      }),
    );
    renderLayer();
    await sceneShows(frameOf("in-view-zone-full"));
    act(() => {
      store.dispatch(selectColumn(COLUMN_2));
    });
    // The preset list is open: the draft is not in the store yet.
    expect(litCells()).toEqual([]);

    act(() => {
      store.dispatch(openEditor([2, 4]));
    });
    expect(litCells()).toEqual(["2", "4"]);

    act(() => {
      store.dispatch(setDraft([5]));
    });
    expect(litCells()).toEqual(["5"]);

    act(() => {
      store.dispatch(backToPresets());
    });
    expect(litCells()).toEqual([]);
  });
});

describe("DrawerOrganizerLayer: the Top | Bottom switch", () => {
  const bothDrawers = (topCapacity: number, botCapacity: number) =>
    act(() => {
      store.dispatch(
        recordDerived({
          cabinetKey: "cab-1",
          drawers: { Top: editableDrawer(topCapacity), Bot: editableDrawer(botCapacity) },
        }),
      );
    });

  it("is there when both drawers of the cabinet in view can take columns, and moves to the other drawer", async () => {
    renderLayer();
    await sceneShows(frameOf("in-view-empty"));
    await bothDrawers(3, 3);

    await act(async () => {
      fireEvent.click(within(screen.getByRole("group", { name: "Drawer" })).getByRole("button", { name: "Bottom" }));
    });

    expect(fake.calls.filter(({ kind }) => kind === "enterView")).toEqual([
      { kind: "enterView", address: { runtimeId: "rt-1", drawer: "Bot" } },
    ]);
  });

  it("is not there when one of the drawers has no room (capacity 0)", async () => {
    renderLayer();
    await sceneShows(frameOf("in-view-empty"));
    await bothDrawers(3, 0);
    expect(screen.queryByRole("group", { name: "Drawer" })).toBeNull();
  });
});

describe("DrawerOrganizerLayer: the notice", () => {
  const status = () => screen.getByRole("status");

  it("is a polite live region that is empty until there is something to say", () => {
    renderLayer();
    expect(status().getAttribute("aria-live")).toBe("polite");
    expect(status().textContent).toBe("");
  });

  it("says what happened in the words of the collection and how to undo it", () => {
    renderLayer();
    act(() => {
      store.dispatch(showNotice({ key: "organizer.columnRemoved", undoHint: true }));
    });
    expect(status().textContent).toContain("Column removed.");
    expect(status().textContent).toContain("Use Undo to bring them back.");
  });

  it("fills the numbers into the text and offers no undo hint when nothing changed", () => {
    renderLayer();
    act(() => {
      store.dispatch(showNotice({ key: "organizer.trimmed", params: { n: 2 }, undoHint: false }));
    });
    expect(status().textContent).toContain("2 column(s) no longer fit and were removed.");
    expect(status().textContent).not.toContain("Undo");
  });

  it("closes with × (Dismiss)", () => {
    renderLayer();
    act(() => {
      store.dispatch(showNotice({ key: "organizer.cleared", undoHint: true }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(status().textContent).toBe("");
    expect(ui(store).notice).toBeNull();
  });

  it("closes itself after 5 s", () => {
    vi.useFakeTimers();
    renderLayer();
    act(() => {
      store.dispatch(showNotice({ key: "organizer.cleared", undoHint: true }));
    });

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(status().textContent).toContain("Dividers removed.");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status().textContent).toBe("");
  });

  it("a new notice restarts the 5 s", () => {
    vi.useFakeTimers();
    renderLayer();
    act(() => {
      store.dispatch(showNotice({ key: "organizer.cleared", undoHint: true }));
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => {
      store.dispatch(showNotice({ key: "organizer.cleared", undoHint: true }));
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(status().textContent).toContain("Dividers removed.");
  });

  it("a tap on the locked zone says why in the collection's words, and closes after 2.5 s", async () => {
    vi.useFakeTimers();
    renderLayer();
    await sceneShows(frameOf("in-view-zone-full"));

    fireEvent.click(screen.getByRole("img", { name: /Drain area/ }));
    expect(status().textContent).toContain("Drain area — dividers can't be placed here.");

    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(status().textContent).toContain("Drain area");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status().textContent).toBe("");
  });

  it("is shown even where the controls are not (the option went back to None)", () => {
    renderLayer({ customize: false });
    act(() => {
      store.dispatch(showNotice({ key: "organizer.cleared", undoHint: true }));
    });
    expect(screen.queryByTestId("organizer-overlay")).toBeNull();
    expect(status().textContent).toContain("Dividers removed.");
  });
});
