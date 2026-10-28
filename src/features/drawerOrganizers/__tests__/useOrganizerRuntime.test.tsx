// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ushProfileDocument from "../../../../public/collections/urban-standard-height/product-profile.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { finishRestore, recordSceneState, startRestore, syncCabinets } from "@/entities/configuration";
import type { OrganizersState } from "@/entities/configuration/model/drawerOrganizers";
import { setActiveProfile, setPlacedCabinetStyle } from "@/entities/product/model/store/slice";
import { createTestOrganizerPort, type TestOrganizerPort } from "@/features/playCanvasAdapter";
import contractFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";
import framesFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/frames.v1.json";
import type { OrganizersChange, OrganizersOverlayFrame } from "@/features/configuratorApi";

import { createOrganizerOverlayStore, type OrganizerOverlayStore } from "../lib/organizerOverlayStore";
import { useOrganizerRuntime } from "../lib/useOrganizerRuntime";
import { openEditor, selectColumn, setSectionActive, setView } from "../model/store/slice";
import {
  createOrganizerTestStore,
  organizers,
  record,
  steps,
  ui,
  withStore,
  type OrganizerTestStore,
} from "./organizerHookSetup";
import { answerOf, endStateOf, startStateOf } from "./organizerPortAnswers";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));

/**
 * The organizer runtime: the one listener of the scene. Events reach the read-model, the derived state,
 * `isDrawerOpen` and the overlay store; a restore is read again; an implicit exit writes the draft.
 */

type ContractCase = (typeof contractFixture.cases)[number];
const contractCase = (name: string): ContractCase => contractFixture.cases.find((testCase) => testCase.name === name)!;

/** The product's state as 3D reports it after the contract case's normalization. */
const stateOf = (name: string, productId = "rt-1", revision = 1): OrganizersState =>
  ({
    productId,
    revision,
    params: contractCase(name).params,
    state: contractCase(name).expected.state,
    drawers: contractCase(name).expected.derived,
    lastCorrections: contractCase(name).expected.diagnostics,
  }) as OrganizersState;

const changeOf = (name: string, reason: OrganizersChange["reason"], productId = "rt-1"): OrganizersChange => ({
  productId,
  revision: 2,
  state: stateOf(name, productId),
  corrections: contractCase(name).expected.diagnostics as OrganizersChange["corrections"],
  reason,
});

let store: OrganizerTestStore;
let fake: TestOrganizerPort;
let overlay: OrganizerOverlayStore;

const mount = (ready = true) =>
  renderHook(({ isReady }) => useOrganizerRuntime(isReady, { port: fake.port, overlay }), {
    wrapper: withStore(store),
    initialProps: { isReady: ready },
  });

/** Lets the subscriptions (promises) settle. */
const settle = () => act(async () => {});

beforeEach(() => {
  store = createOrganizerTestStore();
  fake = createTestOrganizerPort();
  overlay = createOrganizerOverlayStore();
});

describe("useOrganizerRuntime: subscriptions", () => {
  it("subscribes once while ready, and leaves nothing behind on unmount (the overlay store is emptied)", async () => {
    const runtime = mount();
    await settle();
    expect(["change", "view", "frame", "pointer"].map((event) => fake.listeners(event as "change"))).toEqual([
      1, 1, 1, 1,
    ]);

    act(() => fake.emit("frame", framesFixture.cases[0].expected as OrganizersOverlayFrame));
    expect(overlay.get()).toEqual(framesFixture.cases[0].expected);

    runtime.unmount();
    expect(["change", "view", "frame", "pointer"].map((event) => fake.listeners(event as "change"))).toEqual([
      0, 0, 0, 0,
    ]);
    expect(overlay.get()).toBeNull();
  });

  it("unsubscribes when the scene stops being ready", async () => {
    const runtime = mount();
    await settle();

    runtime.rerender({ isReady: false });

    expect(fake.listeners("change")).toBe(0);
    expect(overlay.get()).toBeNull();
  });

  it("subscribes to nothing for a collection without organizers (USH)", async () => {
    const parsed = parseProductProfile(ushProfileDocument);
    if (!parsed.ok) throw new Error("ush profile");
    store.dispatch(setActiveProfile(parsed.profile));

    mount();
    await settle();

    expect(fake.listeners("change")).toBe(0);
    expect(fake.calls).toEqual([]);
  });
});

describe("useOrganizerRuntime: change", () => {
  it("records the read-model and the derived state of each product, by stable key", async () => {
    mount();
    await settle();

    act(() => {
      fake.emit("change", changeOf("sc120-example1", "current"));
      fake.emit("change", changeOf("empty-sb60", "current", "rt-2"));
    });

    expect(organizers(store)).toEqual({
      "cab-1": { status: "ok", value: contractCase("sc120-example1").expected.state },
    });
    expect(ui(store).derived["cab-2:Top"]).toEqual(contractCase("empty-sb60").expected.derived.Top);
    expect(ui(store).notice).toBeNull();
  });

  it("tells the user how many columns a narrower cabinet dropped, with undo (T19)", async () => {
    record(store, "cab-1", { status: "ok", value: contractCase("sc120-example1").expected.state as never });
    mount();
    await settle();

    act(() => fake.emit("change", changeOf("width-120-to-60", "width")));

    expect(ui(store).notice).toMatchObject({ key: "organizer.trimmed", params: { n: 2 }, undoHint: true });
    expect(organizers(store)["cab-1"]).toEqual({ status: "ok", value: contractCase("width-120-to-60").expected.state });
  });

  it("counts the columns of a drawer that went away", async () => {
    record(store, "cab-1", { status: "ok", value: contractCase("sc120-example1").expected.state as never });
    mount();
    await settle();

    act(() => fake.emit("change", changeOf("class-2d-to-1d", "drawers")));

    // sc120-example1 had three Top columns.
    expect(ui(store).notice).toMatchObject({ key: "organizer.drawerRemoved", params: { n: 3 }, undoHint: true });
  });

  it("only logs the corrections of a restore", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mount();
    await settle();

    act(() => fake.emit("change", changeOf("sc-to-sb", "restore")));

    expect(ui(store).notice).toBeNull();
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });

  it("says the columns went with a cabinet type change when they vanish without a correction (Q-O5)", async () => {
    record(store, "cab-1", { status: "ok", value: contractCase("sb60-example2").expected.state as never });
    mount();
    await settle();

    act(() => fake.emit("change", changeOf("empty-sb60", "created")));

    expect(organizers(store)).toEqual({});
    expect(ui(store).notice).toMatchObject({ key: "organizer.typeChanged", undoHint: true });
  });

  it("logs a product it has no stable key for", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mount();
    await settle();

    act(() => fake.emit("change", changeOf("sc120-example1", "created", "rt-9")));

    expect(organizers(store)).toEqual({});
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });

  it("reads a cabinet once when it gets its stable key, so a `created` sent before that is not lost", async () => {
    fake.setList([stateOf("sc120-example1", "rt-3")]);
    mount();
    await settle();
    expect(fake.calls.filter(({ kind }) => kind === "getState")).toEqual([
      { kind: "getState", runtimeId: "rt-1" },
      { kind: "getState", runtimeId: "rt-2" },
    ]);

    await act(async () => {
      store.dispatch(syncCabinets(["rt-1", "rt-2", "rt-3"]));
    });
    await act(async () => {
      store.dispatch(syncCabinets(["rt-1", "rt-2", "rt-3"]));
    });

    expect(fake.calls.filter(({ kind }) => kind === "getState")).toHaveLength(3);
    expect(organizers(store)).toEqual({
      "cab-3": { status: "ok", value: contractCase("sc120-example1").expected.state },
    });
    expect(ui(store).derived["cab-3:Bot"]).toEqual(contractCase("sc120-example1").expected.derived.Bot);
  });
});

describe("useOrganizerRuntime: read-back without a `change`", () => {
  const getStateCalls = () => fake.calls.filter(({ kind }) => kind === "getState");
  const listCalls = () => fake.calls.filter(({ kind }) => kind === "list");

  /** The scene reports the size of the given cabinets (cm); this is what `dimensionsByCabinet` records. */
  const reportSizes = (sizes: Record<string, { width: number; height: number }>) =>
    store.dispatch(
      recordSceneState({
        order: ["rt-1", "rt-2"],
        cabinets: Object.entries(sizes).map(([runtimeId, { width, height }]) => ({
          runtimeId,
          dimensions: { width, height, depth: 52 },
        })),
      }),
    );

  it("reads only the product whose width changed, and refreshes its derived state (SC 60 -> 120)", async () => {
    // ASSUMPTION: the signal is the size the scene reader records (`dimensionsByCabinet`) plus the cabinet's
    // drawer style (`placedCabinetStyles`), compared per cabinet as `Width|Height|Drawers`.
    fake.setList([stateOf("empty-sb60", "rt-1"), stateOf("empty-sb60", "rt-2")]);
    reportSizes({ "rt-1": { width: 60, height: 40 }, "rt-2": { width: 60, height: 40 } });
    mount();
    await settle();
    expect(getStateCalls()).toHaveLength(2);
    expect(ui(store).derived["cab-1:Bot"]).toEqual(contractCase("empty-sb60").expected.derived.Bot);

    // 3D now holds the wider cabinet; it sent no `change`, so only the size tells the UI.
    fake.setList([stateOf("sc120-example1", "rt-1"), stateOf("empty-sb60", "rt-2")]);
    await act(async () => {
      reportSizes({ "rt-1": { width: 120, height: 40 } });
    });

    expect(getStateCalls().slice(2)).toEqual([{ kind: "getState", runtimeId: "rt-1" }]);
    expect(ui(store).derived["cab-1:Bot"]).toEqual(contractCase("sc120-example1").expected.derived.Bot);
  });

  it("reads a product again when its drawers change (1D -> 2D keeps the width)", async () => {
    fake.setList([stateOf("empty-sb60", "rt-1"), stateOf("empty-sb60", "rt-2")]);
    mount();
    await settle();
    expect(getStateCalls()).toHaveLength(2);

    await act(async () => {
      store.dispatch(setPlacedCabinetStyle({ id: "rt-2", value: "2D" }));
    });

    expect(getStateCalls().slice(2)).toEqual([{ kind: "getState", runtimeId: "rt-2" }]);
  });

  it("makes no extra call while the sizes and drawers stay the same", async () => {
    reportSizes({ "rt-1": { width: 60, height: 40 }, "rt-2": { width: 60, height: 40 } });
    mount();
    await settle();
    const callsAfterFirstRead = fake.calls.length;

    await act(async () => {
      reportSizes({ "rt-1": { width: 60, height: 40 } });
      reportSizes({ "rt-2": { width: 60, height: 40 } });
      store.dispatch(syncCabinets(["rt-1", "rt-2"]));
    });

    expect(fake.calls).toHaveLength(callsAfterFirstRead);
  });

  it("reads and lists nothing for a collection without organizers (USH)", async () => {
    const parsed = parseProductProfile(ushProfileDocument);
    if (!parsed.ok) throw new Error("ush profile");
    store.dispatch(setActiveProfile(parsed.profile));
    mount();
    await settle();

    await act(async () => {
      reportSizes({ "rt-1": { width: 120, height: 52 } });
      store.dispatch(setPlacedCabinetStyle({ id: "rt-1", value: "2D" }));
      store.dispatch(setSectionActive(true));
    });

    expect(fake.calls).toEqual([]);
  });

  it("reads every product once when the section opens, not when it closes", async () => {
    mount();
    await settle();
    expect(listCalls()).toHaveLength(0);

    // 3D holds states the UI has not recorded yet (nothing was sent while the section was shut).
    fake.setList([stateOf("sc120-example1", "rt-1"), stateOf("sb60-example2", "rt-2")]);
    await act(async () => {
      store.dispatch(setSectionActive(true));
    });
    expect(listCalls()).toHaveLength(1);
    expect(ui(store).derived["cab-2:Top"]).toEqual(contractCase("sb60-example2").expected.derived.Top);

    await act(async () => {
      store.dispatch(setSectionActive(false));
    });
    expect(listCalls()).toHaveLength(1);
  });
});

describe("useOrganizerRuntime: view and taps", () => {
  it("mirrors the drawer in view into isDrawerOpen, both ways", async () => {
    mount();
    await settle();

    act(() => fake.emit("view", { view: { productId: "rt-2", drawer: "Bot" }, reason: "enter" }));
    expect(ui(store).view).toEqual({ cabinetKey: "cab-2", drawer: "Bot" });
    expect(store.getState().rootStateUI.product.isDrawerOpen).toBe(true);

    act(() => fake.emit("view", { view: null, reason: "exit" }));
    expect(ui(store).view).toBeNull();
    expect(store.getState().rootStateUI.product.isDrawerOpen).toBe(false);
  });

  it("a background tap clears the selection in the presets (T16) and pulses Save in the editor (T17)", async () => {
    mount();
    await settle();
    const tap = { kind: "background" as const, point: { x: 1, y: 1 }, source: "mouse" as const };
    act(() => {
      store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Top" }));
      store.dispatch(selectColumn({ cabinetKey: "cab-1", drawer: "Top", slot: 0 }));
    });

    act(() => fake.emit("pointer", tap));
    expect(ui(store)).toMatchObject({ selected: null, panel: "closed" });

    act(() => {
      store.dispatch(selectColumn({ cabinetKey: "cab-1", drawer: "Top", slot: 0 }));
      store.dispatch(openEditor([2]));
    });
    act(() => fake.emit("pointer", tap));
    expect(ui(store)).toMatchObject({ panel: "editor", draft: [2], savePulse: 1 });
  });
});

describe("useOrganizerRuntime: restore and implicit exit", () => {
  it("reads every product again once a saved configuration came back", async () => {
    fake.setList([stateOf("sc120-example1", "rt-1"), stateOf("sb60-example2", "rt-2")]);
    store.dispatch(startRestore("config-1"));
    mount();
    await settle();

    await act(async () => {
      store.dispatch(syncCabinets(["rt-1", "rt-2"]));
      store.dispatch(finishRestore({ status: "restored", reason: null, message: null }));
    });

    expect(fake.calls).toContainEqual({ kind: "list" });
    expect(Object.keys(organizers(store)).sort()).toEqual(["cab-1", "cab-2"]);
    expect(ui(store).derived["cab-2:Top"]).toEqual(contractCase("sb60-example2").expected.derived.Top);
  });

  it("closing the section writes a changed draft as one step and leaves the view (T3)", async () => {
    record(store, "cab-1", startStateOf("preset"));
    fake = createTestOrganizerPort({ answers: [answerOf("preset")] });
    mount();
    await settle();
    act(() => {
      store.dispatch(setSectionActive(true));
      store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Top" }));
      store.dispatch(selectColumn({ cabinetKey: "cab-1", drawer: "Top", slot: 0 }));
      store.dispatch(openEditor([2, 4]));
    });

    await act(async () => {
      store.dispatch(setSectionActive(false));
    });
    await settle();

    expect(fake.commands()).toEqual([
      { kind: "setColumnLayout", runtimeId: "rt-1", drawer: "Top", slot: 0, positions: [2, 4] },
    ]);
    expect(steps(store)).toBe(1);
    expect(organizers(store)["cab-1"]).toEqual(endStateOf("preset"));
    expect(fake.calls.at(-1)).toEqual({ kind: "exitView" });
  });
});
