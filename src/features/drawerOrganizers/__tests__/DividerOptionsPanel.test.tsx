// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ushProfile } from "@/entities/collection/__tests__/ushProfileFixture";
import { setActiveProfile } from "@/entities/product/model/store/slice";
import { createTestOrganizerPort, type TestOrganizerPort } from "@/features/playCanvasAdapter";

import { DividerOptionsPanel, usePlayerLeftInset } from "../ui/DividerOptionsPanel";
import { backToPresets, pulseSave, recordDerived, selectColumn, setPanelLayout, setView } from "../model/store/slice";
import { createOrganizerTestStore, organizers, record, steps, ui, type OrganizerTestStore } from "./organizerHookSetup";
import { classCollection, columnsEntry, installMatchMedia, MEDIA, withPage } from "./organizerUiSetup";
import { answerOf, portResultOf } from "./organizerPortAnswers";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));

// The panel and its hooks make their own port; the test hands them the fake one.
const fakePort = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/features/playCanvasAdapter/lib/createOrganizerPort", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/playCanvasAdapter/lib/createOrganizerPort")>()),
  createOrganizerPort: () => fakePort.current,
}));

/**
 * The Divider Options panel (C1 §3, T9–T18): which part shows, what the cards and the editor do through the
 * editor hook, the keys, where the focus goes, and the insets it asks 3D to leave free.
 */

const TOP = { cabinetKey: "cab-1", drawer: "Top" as const };
const COLUMN = { ...TOP, slot: 0 };
const NO_INSETS = { left: 0, right: 0, top: 0, bottom: 0 };

/** The scene repairs the draft [1, 3] to itself (the fixture case "layout-fixed" sends [5, 1, 1, 3]). */
const savesDraft13 = () =>
  createTestOrganizerPort({
    answers: [{ match: { kind: "setColumnLayout", positions: [1, 3] }, result: portResultOf("layout-fixed") }],
  });

let store: OrganizerTestStore;
let fake: TestOrganizerPort;
let media: ReturnType<typeof installMatchMedia>;

const useFake = (next: TestOrganizerPort) => {
  fake = next;
  fakePort.current = next.port;
};

beforeEach(() => {
  store = createOrganizerTestStore();
  useFake(createTestOrganizerPort());
  media = installMatchMedia();
});

afterEach(cleanup);

/** The drawer in view with one column selected (positions as given), the preset list showing. */
const selectedColumn = (positions: number[] = [2]) => {
  record(store, "cab-1", columnsEntry({ Top: [{ slot: 0, positions }] }));
  store.dispatch(setView(TOP));
  store.dispatch(selectColumn(COLUMN));
};

const renderPanel = (collection = classCollection()) =>
  render(
    <>
      {/* Stands in for the column button of the canvas layer, which gets the focus back. */}
      <button data-organizer-slot="0">column</button>
      <DividerOptionsPanel />
    </>,
    { wrapper: withPage(store, collection) },
  );

const radios = () => within(screen.getByRole("radiogroup")).getAllByRole("radio");
const insetCalls = () => fake.calls.filter(({ kind }) => kind === "setViewInsets");

describe("DividerOptionsPanel: when it shows", () => {
  it("is not there while no column is selected", () => {
    store.dispatch(setView(TOP));
    renderPanel();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("is not there without a drawer in view", () => {
    renderPanel();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("shows the title of ui.json in an aside of the same name, and takes the focus", () => {
    selectedColumn();
    renderPanel(classCollection({ panelTitle: "Column options" }));

    const aside = screen.getByRole("complementary", { name: "Column options" });
    const title = within(aside).getByRole("heading", { level: 2, name: "Column options" });
    expect(title.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(title);
  });

  it("calls the panel Divider Options when ui.json has no title", () => {
    selectedColumn();
    renderPanel(classCollection({ panelTitle: undefined }));
    expect(screen.getByRole("complementary", { name: "Divider Options" })).toBeTruthy();
  });

  it("appears when a column is selected and goes when the selection is cleared", () => {
    store.dispatch(setView(TOP));
    record(store, "cab-1", columnsEntry({ Top: [{ slot: 0, positions: [2] }] }));
    renderPanel();
    expect(screen.queryByRole("complementary")).toBeNull();

    act(() => {
      store.dispatch(selectColumn(COLUMN));
    });
    expect(screen.getByRole("complementary")).toBeTruthy();

    act(() => {
      store.dispatch(selectColumn(null));
    });
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("DividerOptionsPanel: the preset list (P1)", () => {
  it("checks the preset the column matches", () => {
    selectedColumn([2, 4]);
    renderPanel();
    expect(radios().filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Preset 4" }).getAttribute("aria-checked")).toBe("true");
  });

  it("checks Customize with the word Custom for a column that matches no preset", () => {
    selectedColumn([1, 3]);
    renderPanel();
    expect(screen.getByRole("radio", { name: /Customize/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Custom")).toBeTruthy();
  });

  it("applies a preset as one step and keeps the list open with that preset active (T11, 28.10: the panel stays)", async () => {
    selectedColumn([2]);
    useFake(createTestOrganizerPort({ answers: [answerOf("preset")] }));
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Preset 4" }));
    });

    expect(fake.commands()).toEqual([
      { kind: "setColumnLayout", runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [2, 4] },
    ]);
    expect(steps(store)).toBe(1);
    expect(screen.getByRole("complementary")).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Preset 4" }).getAttribute("aria-checked")).toBe("true");
  });

  it("removes the column and closes the panel (T18)", async () => {
    selectedColumn();
    useFake(createTestOrganizerPort({ answers: [answerOf("remove-last")] }));
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove column" }));
    });

    expect(fake.commands()).toEqual([{ kind: "removeColumn", runtimeId: "rt-1", drawer: "Top", slot: 0 }]);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("keeps the focus in the panel after a preset (the panel does not close)", async () => {
    selectedColumn([2]);
    useFake(createTestOrganizerPort({ answers: [answerOf("preset")] }));
    renderPanel();
    const card = screen.getByRole("radio", { name: "Preset 4" });
    card.focus();

    await act(async () => {
      fireEvent.click(card);
    });

    expect(document.activeElement).toBe(card);
  });
});

describe("DividerOptionsPanel: the editor (P2)", () => {
  const openEditor = () => {
    selectedColumn([2]);
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: /Customize/ }));
  };
  const positions = () =>
    within(screen.getByRole("group", { name: "Divider positions, back to front" })).getAllByRole("button");

  it("opens on the positions of the column (T12)", () => {
    openEditor();
    expect(ui(store)).toMatchObject({ panel: "editor", draft: [2] });
    expect(positions().map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
      "false",
      "false",
    ]);
  });

  it("previews each toggle without a step, and stops at maxActive pressed (R-D; 5 for ROW-MTL-43)", () => {
    openEditor();

    fireEvent.click(positions()[3]);
    expect(ui(store).draft).toEqual([2, 4]);
    expect(screen.getByText("Inserts 2 of 5")).toBeTruthy();
    expect(steps(store)).toBe(0);
    expect(fake.calls.filter(({ kind }) => kind === "preview")).toHaveLength(1);
    // Below the limit every cell stays live.
    expect(positions().map((button) => (button as HTMLButtonElement).disabled)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);

    fireEvent.click(positions()[0]);
    fireEvent.click(positions()[2]);
    fireEvent.click(positions()[4]);
    expect(ui(store).draft).toEqual([1, 2, 3, 4, 5]);
    expect(screen.getByText("Inserts 5 of 5")).toBeTruthy();
    expect(fake.calls.filter(({ kind }) => kind === "preview")).toHaveLength(4);
  });

  it("takes the limit from what 3D derived for the drawer", () => {
    selectedColumn([2]);
    store.dispatch(
      recordDerived({
        cabinetKey: "cab-1",
        drawers: {
          Top: {
            exists: true,
            offered: true,
            role: "single",
            profile: { id: "ROW-MTL-43", pitchM: 0.1, positionCount: 5, maxActive: 1, codec: "cells-v1" },
            maxSlot: 2,
            capacity: 3,
            count: 1,
            lock: null,
            candidates: [],
            unavailable: null,
          },
        },
      }),
    );
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: /Customize/ }));

    expect(screen.getByText("Inserts 1 of 1")).toBeTruthy();
    expect(positions().map((button) => (button as HTMLButtonElement).disabled)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
  });

  it("Save writes the draft as one step and returns to the preset list (T15, 28.10: the panel stays)", async () => {
    useFake(savesDraft13());
    selectedColumn([2]);
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: /Customize/ }));
    fireEvent.click(positions()[0]);
    fireEvent.click(positions()[1]);
    fireEvent.click(positions()[2]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(fake.commands()).toEqual([
      { kind: "setColumnLayout", runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [1, 3] },
    ]);
    expect(steps(store)).toBe(1);
    expect(screen.getByRole("radiogroup")).not.toBeNull();
    expect(screen.getByRole("radio", { name: /Customize/ }).getAttribute("aria-checked")).toBe("true");
    expect(organizers(store)["cab-1"]).toBeDefined();
  });

  it("← drops the draft without a step and puts the focus on the Customize card (T14)", () => {
    openEditor();
    fireEvent.click(positions()[0]);

    fireEvent.click(screen.getByRole("button", { name: "Back to presets" }));

    expect(ui(store)).toMatchObject({ panel: "presets", draft: null });
    expect(steps(store)).toBe(0);
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: /Customize/ }));
  });

  it("makes Save pulse again for every click outside the editor (T16, T10)", () => {
    openEditor();
    const save = () => screen.getByRole("button", { name: "Save" });
    expect(save().getAttribute("data-pulse")).toBe("0");

    act(() => {
      store.dispatch(pulseSave());
    });
    expect(save().getAttribute("data-pulse")).toBe("1");
    expect(save().querySelector("[data-save-pulse]")).not.toBeNull();
  });

  it("marks Save busy while the command runs", async () => {
    useFake(savesDraft13());
    openEditor();
    const gate = fake.hold();

    let saving!: Promise<void>;
    await act(async () => {
      saving = Promise.resolve().then(() => {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
      });
      await vi.waitFor(() => expect(ui(store).busy).toBe(true));
    });
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      gate.release();
      await saving;
    });
  });
});

describe("DividerOptionsPanel: the keys", () => {
  it("Esc in the preset list clears the selection", () => {
    selectedColumn();
    renderPanel();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(ui(store)).toMatchObject({ selected: null, panel: "closed" });
  });

  it("Esc in the editor goes back to the list and keeps the column selected (T14)", () => {
    selectedColumn();
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: /Customize/ }));

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(ui(store)).toMatchObject({ panel: "presets", selected: COLUMN });
  });

  it.each(["Delete", "Backspace"])("%s in the preset list removes the column", async (key) => {
    selectedColumn();
    useFake(createTestOrganizerPort({ answers: [answerOf("remove-last")] }));
    renderPanel();

    await act(async () => {
      fireEvent.keyDown(document.body, { key });
    });

    expect(fake.commands()).toEqual([{ kind: "removeColumn", runtimeId: "rt-1", drawer: "Top", slot: 0 }]);
  });

  it("Delete in the editor does nothing", async () => {
    selectedColumn();
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: /Customize/ }));

    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Delete" });
    });

    expect(fake.commands()).toEqual([]);
    expect(ui(store).panel).toBe("editor");
  });

  it("leaves Backspace and Delete to a text field", async () => {
    selectedColumn();
    renderPanel();
    const field = document.createElement("input");
    document.body.append(field);

    await act(async () => {
      fireEvent.keyDown(field, { key: "Backspace" });
    });
    field.remove();

    expect(fake.commands()).toEqual([]);
  });

  it("listens to nothing once the panel is closed", async () => {
    selectedColumn();
    renderPanel();
    act(() => {
      store.dispatch(selectColumn(null));
    });

    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Delete" });
    });

    expect(fake.commands()).toEqual([]);
  });
});

describe("DividerOptionsPanel: layout and the room it takes from the 3D view", () => {
  it("is the desktop panel above 1024 px: 3D keeps 160 px free on the left", () => {
    selectedColumn();
    renderPanel();

    expect(ui(store).layout).toBe("desktop");
    expect(insetCalls()).toEqual([{ kind: "setViewInsets", insets: { ...NO_INSETS, left: 160 } }]);
    expect(screen.getByRole("complementary").getAttribute("data-layout")).toBe("desktop");
    expect(screen.getByRole("radiogroup").parentElement?.getAttribute("data-layout")).toBe("vertical");
  });

  it("is the bottom strip (M2) on a phone: 72 px free at the bottom, cards in a row", () => {
    media.match(MEDIA.compact);
    selectedColumn();
    renderPanel();

    expect(ui(store).layout).toBe("m2");
    expect(insetCalls()).toEqual([{ kind: "setViewInsets", insets: { ...NO_INSETS, bottom: 72 } }]);
    expect(screen.getByRole("radiogroup").parentElement?.getAttribute("data-layout")).toBe("horizontal");
  });

  it("stays M2 on a phone when ui.json does not ask for M1", () => {
    media.match(MEDIA.compact);
    selectedColumn();
    renderPanel(classCollection({ mobileLayout: undefined }));
    expect(ui(store).layout).toBe("m2");
  });

  it("is the side rail (M1) on a phone when ui.json asks for it: 96 px left, 58 px top", () => {
    media.match(MEDIA.compact);
    selectedColumn();
    renderPanel(classCollection({ mobileLayout: "M1" }));

    expect(ui(store).layout).toBe("m1");
    expect(insetCalls()).toEqual([{ kind: "setViewInsets", insets: { ...NO_INSETS, left: 96, top: 58 } }]);
    expect(screen.getByRole("radiogroup").parentElement?.getAttribute("data-layout")).toBe("vertical");
  });

  it.each([
    ["a short screen", MEDIA.short],
    ["a landscape phone", MEDIA.landscape],
  ])("falls back to M2 on %s even when ui.json asks for M1", (_name, query) => {
    media.match(MEDIA.compact, query);
    selectedColumn();
    renderPanel(classCollection({ mobileLayout: "M1" }));
    expect(ui(store).layout).toBe("m2");
  });

  it("follows the window: a phone turned to landscape changes the insets", () => {
    media.match(MEDIA.compact);
    selectedColumn();
    renderPanel(classCollection({ mobileLayout: "M1" }));
    expect(ui(store).layout).toBe("m1");

    act(() => media.match(MEDIA.compact, MEDIA.landscape));

    expect(ui(store).layout).toBe("m2");
    expect(insetCalls().at(-1)).toEqual({ kind: "setViewInsets", insets: { ...NO_INSETS, bottom: 72 } });
  });

  it("gives the room back when the panel closes", () => {
    selectedColumn();
    renderPanel();
    act(() => {
      store.dispatch(selectColumn(null));
    });
    expect(insetCalls().at(-1)).toEqual({ kind: "setViewInsets", insets: NO_INSETS });
  });

  it("asks 3D for nothing while it has never been open", () => {
    renderPanel();
    expect(insetCalls()).toEqual([]);
  });
});

describe("usePlayerLeftInset", () => {
  const read = () => renderHook(() => usePlayerLeftInset(), { wrapper: withPage(store) }).result;

  it("is 160px beside the open desktop panel", () => {
    selectedColumn();
    expect(read().current).toBe("160px");
  });

  it("is 96px beside the M1 rail", () => {
    selectedColumn();
    store.dispatch(setPanelLayout("m1"));
    expect(read().current).toBe("96px");
  });

  it("is unset for the M2 strip, which sits under the canvas", () => {
    selectedColumn();
    store.dispatch(setPanelLayout("m2"));
    expect(read().current).toBeUndefined();
  });

  it("is unset while the panel is closed, and in the editor it is as wide as in the list", () => {
    store.dispatch(setView(TOP));
    expect(read().current).toBeUndefined();
    cleanup();

    selectedColumn();
    store.dispatch(selectColumn(null));
    expect(read().current).toBeUndefined();
    cleanup();

    selectedColumn();
    store.dispatch(backToPresets());
    expect(read().current).toBe("160px");
  });
});

describe("a collection without organizers (USH): nothing of the panel is there", () => {
  beforeEach(() => {
    store.dispatch(setActiveProfile(ushProfile));
  });

  it("draws no panel even if the UI state says a column is selected, and never asks 3D for room", () => {
    selectedColumn();
    renderPanel();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(insetCalls()).toEqual([]);
  });

  it("leaves --player-left-inset unset", () => {
    selectedColumn();
    const { result } = renderHook(() => usePlayerLeftInset(), { wrapper: withPage(store) });
    expect(result.current).toBeUndefined();
  });
});
