// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DrawerDerived } from "@/entities/configuration/model/drawerOrganizers";
import { setHistoryRestoring } from "@/entities/history/model/store/slice";
import { createTestOrganizerPort, type TestOrganizerPort } from "@/features/playCanvasAdapter";

import { useOrganizerEditor } from "../lib/useOrganizerEditor";
import { recordDerived, selectColumn, setPendingStyle, setView } from "../model/store/slice";
import {
  createOrganizerTestStore,
  organizers,
  record,
  steps,
  ui,
  withStore,
  type OrganizerTestStore,
} from "./organizerHookSetup";
import { answerOf, endStateOf, portResultOf, startStateOf } from "./organizerPortAnswers";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));

/**
 * The organizer actions (C1 §1.3) against the fake port answering from the shared `commands.v1.json`:
 * one user action is one history step, written only when the scene took it; previews never are.
 */

const TOP = { cabinetKey: "cab-1", drawer: "Top" as const };

/** What 3D would derive for a drawer whose profile allows `maxActive` inserts per column. */
const limitedDerived = (maxActive: number): DrawerDerived => ({
  exists: true,
  offered: true,
  role: "outer",
  profile: { id: "ROW-MTL-43", pitchM: 0.1, positionCount: 5, maxActive, codec: "cells-v1" },
  maxSlot: 2,
  capacity: 5,
  count: 1,
  lock: null,
  candidates: [],
  unavailable: null,
});
const COLUMN = { ...TOP, slot: 0 };

let store: OrganizerTestStore;
let fake: TestOrganizerPort;

const render = () => renderHook(() => useOrganizerEditor({ port: fake.port }), { wrapper: withStore(store) }).result;

/** The drawer in view and one column of it selected, with the scene holding `stateCase`'s start state. */
const inView = (stateCase: string, { selected = true } = {}) => {
  record(store, "cab-1", startStateOf(stateCase));
  store.dispatch(setView(TOP));
  if (selected) store.dispatch(selectColumn(COLUMN));
};

beforeEach(() => {
  store = createOrganizerTestStore();
  fake = createTestOrganizerPort();
});

describe("useOrganizerEditor: presets", () => {
  it("a preset is one step, keeps the column selected with the list open, and records what the scene holds", async () => {
    inView("preset");
    fake = createTestOrganizerPort({ answers: [answerOf("preset")] });
    const editor = render();

    await act(() => editor.current.applyPreset("preset-4"));

    expect(fake.commands()).toEqual([
      { kind: "setColumnLayout", runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [2, 4] },
    ]);
    expect(steps(store)).toBe(1);
    expect(organizers(store)["cab-1"]).toEqual(endStateOf("preset"));
    expect(ui(store)).toMatchObject({ selected: { cabinetKey: "cab-1", drawer: "Top", slot: 0 }, panel: "presets" });
  });

  it("the preset the column already has is a noop: no step", async () => {
    inView("preset-same");
    fake = createTestOrganizerPort({
      answers: [{ match: { kind: "setColumnLayout", positions: [2, 4] }, result: portResultOf("preset-same") }],
    });
    const editor = render();

    await act(() => editor.current.applyPreset("preset-4"));

    expect(fake.commands()).toHaveLength(1);
    expect(steps(store)).toBe(0);
  });

  it("a double click runs one command: the second click finds the editor busy", async () => {
    inView("preset");
    fake = createTestOrganizerPort({ answers: [answerOf("preset")] });
    const gate = fake.hold();
    const editor = render();

    let first!: Promise<void>;
    await act(async () => {
      first = editor.current.applyPreset("preset-4");
      await vi.waitFor(() => expect(ui(store).busy).toBe(true));
      await editor.current.applyPreset("preset-4");
      await editor.current.addColumn(2);
      gate.release();
      await first;
    });

    expect(fake.commands()).toHaveLength(1);
    expect(ui(store).busy).toBe(false);
    expect(steps(store)).toBe(1);
  });

  it("tells the user why the scene refused, without an undo hint, and writes no step", async () => {
    inView("layout-no-column");
    fake.answerNext(portResultOf("layout-no-column"));
    const editor = render();

    await act(() => editor.current.applyPreset("preset-1"));

    expect(steps(store)).toBe(0);
    expect(ui(store).notice).toMatchObject({ key: "organizer.placeFailed", undoHint: false });
    expect(ui(store).panel).toBe("presets");
  });
});

describe("useOrganizerEditor: the editor", () => {
  it("previews each toggle outside the history, and Save writes the draft as one step", async () => {
    inView("layout-fixed");
    fake = createTestOrganizerPort({
      answers: [{ match: { kind: "setColumnLayout", positions: [1, 3] }, result: portResultOf("layout-fixed") }],
    });
    const editor = render();

    act(() => editor.current.openEditor());
    act(() => {
      editor.current.toggle(3);
      editor.current.toggle(1);
    });
    expect(ui(store)).toMatchObject({ panel: "editor", draft: [1, 3] });
    expect(fake.calls.filter(({ kind }) => kind === "preview")).toEqual([
      { kind: "preview", preview: { runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [3] } },
      { kind: "preview", preview: { runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [1, 3] } },
    ]);
    expect(steps(store)).toBe(0);

    await act(() => editor.current.save());

    expect(steps(store)).toBe(1);
    expect(fake.calls.at(-1)).toEqual({ kind: "preview", preview: null });
    expect(ui(store)).toMatchObject({
      selected: { cabinetKey: "cab-1", drawer: "Top", slot: 0 },
      panel: "presets",
      draft: null,
    });
    expect(organizers(store)["cab-1"]).toEqual(endStateOf("layout-fixed"));
  });

  it("refuses a position past maxActive with a notice and keeps the draft (5 for ROW-MTL-43: the limit is the tray)", () => {
    inView("preset-same");
    const editor = render();

    act(() => editor.current.openEditor());
    act(() => {
      editor.current.toggle(1);
      editor.current.toggle(3);
      editor.current.toggle(5);
    });
    expect(ui(store).draft).toEqual([1, 2, 3, 4, 5]);

    // With every cell pressed a sixth cannot exist, so the limit is tried through a drawer whose profile allows two.
    store.dispatch(recordDerived({ cabinetKey: "cab-1", drawers: { Top: limitedDerived(2) } }));
    act(() => {
      editor.current.toggle(1);
      editor.current.toggle(3);
      editor.current.toggle(5);
    });
    expect(ui(store).draft).toEqual([2, 4]);
    let answer!: { blocked: boolean };
    act(() => {
      answer = editor.current.toggle(1);
    });

    expect(answer).toEqual({ blocked: true });
    expect(ui(store)).toMatchObject({ draft: [2, 4], notice: { key: "organizer.maxPositions", undoHint: false } });
  });

  it("Back drops the draft and the preview, and writes nothing", () => {
    inView("preset");
    const editor = render();

    act(() => {
      editor.current.openEditor();
      editor.current.toggle(2);
      editor.current.back();
    });

    expect(ui(store)).toMatchObject({ panel: "presets", draft: null, selected: COLUMN });
    expect(fake.calls.at(-1)).toEqual({ kind: "preview", preview: null });
    expect(fake.commands()).toEqual([]);
    expect(steps(store)).toBe(0);
  });

  it("a click on another column while editing only pulses Save (T10)", () => {
    inView("preset");
    const editor = render();

    act(() => {
      editor.current.openEditor();
      editor.current.selectColumn(1);
    });

    expect(ui(store)).toMatchObject({ selected: COLUMN, panel: "editor", savePulse: 1 });
  });
});

describe("useOrganizerEditor: implicit exits", () => {
  it("Close Drawer writes a changed draft as one step, then leaves the view", async () => {
    inView("layout-fixed");
    fake = createTestOrganizerPort({
      answers: [{ match: { kind: "setColumnLayout", positions: [1, 3] }, result: portResultOf("layout-fixed") }],
    });
    const editor = render();

    act(() => {
      editor.current.openEditor();
      editor.current.toggle(1);
      editor.current.toggle(3);
    });
    await act(() => editor.current.closeDrawer());

    expect(fake.commands()).toHaveLength(1);
    expect(steps(store)).toBe(1);
    expect(fake.calls.slice(-2)).toEqual([{ kind: "preview", preview: null }, { kind: "exitView" }]);
  });

  it("an unchanged draft leaves without a command", async () => {
    inView("preset-same");
    const editor = render();

    act(() => editor.current.openEditor());
    await act(() => editor.current.leave());

    expect(fake.commands()).toEqual([]);
    expect(fake.calls.at(-1)).toEqual({ kind: "exitView" });
  });

  it("an undo drops the draft: nothing is written on the way out (F10)", async () => {
    inView("preset");
    const editor = render();

    act(() => {
      editor.current.openEditor();
      editor.current.toggle(3);
    });
    act(() => {
      store.dispatch(setHistoryRestoring(true));
    });
    await act(() => editor.current.closeDrawer());
    act(() => {
      store.dispatch(setHistoryRestoring(false));
    });

    expect(fake.commands()).toEqual([]);
    expect(steps(store)).toBe(0);
  });

  it("opening another drawer of the cabinet enters its view", async () => {
    inView("preset", { selected: false });
    const editor = render();

    await act(() => editor.current.switchDrawer("Bot"));
    await act(() => editor.current.openDrawer({ cabinetKey: "cab-2", drawer: "Top" }));

    expect(fake.calls).toEqual([
      { kind: "enterView", address: { runtimeId: "rt-1", drawer: "Bot" } },
      { kind: "enterView", address: { runtimeId: "rt-2", drawer: "Top" } },
    ]);
  });
});

describe("useOrganizerEditor: columns and style", () => {
  it("⊕ adds a column with the drawer's chosen style and selects nothing (I-1)", async () => {
    inView("add-first", { selected: false });
    store.dispatch(setPendingStyle({ address: TOP, style: "Metal" }));
    fake = createTestOrganizerPort({ answers: [{ match: { kind: "addColumn" }, result: portResultOf("add-first") }] });
    const editor = render();

    await act(() => editor.current.addColumn(0));

    expect(fake.commands()).toEqual([{ kind: "addColumn", runtimeId: "rt-1", drawer: "Top", slot: 0, style: "Metal" }]);
    expect(steps(store)).toBe(1);
    expect(ui(store)).toMatchObject({ selected: null, panel: "closed" });
  });

  it("Remove column is one step with a notice that offers undo", async () => {
    inView("remove-last");
    fake = createTestOrganizerPort({ answers: [answerOf("remove-last")] });
    const editor = render();

    await act(() => editor.current.remove());

    expect(steps(store)).toBe(1);
    expect(organizers(store)).toEqual({});
    expect(ui(store)).toMatchObject({ selected: null, notice: { key: "organizer.columnRemoved", undoHint: true } });
  });

  it("a style for an empty drawer is kept for its first column; with columns it is a command", async () => {
    inView("set-style-empty", { selected: false });
    const editor = render();

    await act(() => editor.current.setStyle("Metal"));
    expect(fake.commands()).toEqual([]);
    expect(ui(store).pendingStyle).toEqual({ "cab-1:Top": "Metal" });

    record(store, "cab-1", startStateOf("preset"));
    fake.answerNext({ status: "noop", products: [], corrections: [] });
    await act(() => editor.current.setStyle("Metal"));
    expect(fake.commands()).toEqual([{ kind: "setStyle", runtimeId: "rt-1", drawer: "Top", style: "Metal" }]);
    expect(steps(store)).toBe(0);
  });

  it("reports a scene that is not ready as a failed placement", async () => {
    inView("add-first", { selected: false });
    fake.setReady(false);
    const editor = render();

    await act(() => editor.current.addColumn(0));

    expect(ui(store).notice).toMatchObject({ key: "organizer.placeFailed", undoHint: false });
    expect(steps(store)).toBe(0);
  });
});
