// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReadyCollectionContext } from "@/entities/collection";
import type { DrawerDerived } from "@/entities/configuration/model/drawerOrganizers";
import { setDividersOption } from "@/entities/product/model/store/slice";
import { readyCollectionFixture } from "@/features/configurationCommands/__tests__/readyCollectionFixture";
import type { ChangeResult } from "@/features/configurationCommands";
import type { OrganizersOverlayFrame } from "@/features/configuratorApi";
import { createTestOrganizerPort, type TestOrganizerPort } from "@/features/playCanvasAdapter";
import contractFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/contract.v1.json";
import framesFixture from "@/features/drawerOrganizers/__tests__/fixtures/contract/frames.v1.json";

import { createOrganizerOverlayStore, type OrganizerOverlayStore } from "../lib/organizerOverlayStore";
import { useOrganizerSection } from "../lib/useOrganizerSection";
import { recordDerived, setView } from "../model/store/slice";
import { createOrganizerTestStore, organizers, record, steps, ui, type OrganizerTestStore } from "./organizerHookSetup";
import { startStateOf } from "./organizerPortAnswers";

vi.mock("@/utils/functions/playcanvas/getOrderedProductIds", () => ({
  getOrderedProductIds: (fallback: string[] = []) => fallback,
}));
vi.mock("@/utils/functions/playcanvas/getConfig", () => ({ getConfig: vi.fn(async () => ({ Width: 60 })) }));

/**
 * The Drawer Dividers section (C1 T1–T2, §3.4): the option the page shows, None as one step that clears
 * every cabinet, the hint for each state, and the style chips.
 */

const derivedOf = (name: string): Record<"Top" | "Bot", DrawerDerived> =>
  contractFixture.cases.find((testCase) => testCase.name === name)!.expected.derived as Record<
    "Top" | "Bot",
    DrawerDerived
  >;

const FIELD = {
  attributeId: "DividersOption",
  control: "swatches" as const,
  hints: { Customize: "Click the ⊕ button." },
};

let store: OrganizerTestStore;
let fake: TestOrganizerPort;
let overlay: OrganizerOverlayStore;
let change: ReturnType<typeof vi.fn<(request: { attributeId: string; value: string }) => Promise<ChangeResult>>>;

const render = () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReadyCollectionContext.Provider value={readyCollectionFixture}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/prebuilt/accessories"]}>{children}</MemoryRouter>
      </Provider>
    </ReadyCollectionContext.Provider>
  );
  return renderHook(() => useOrganizerSection({ field: FIELD, port: fake.port, change: change as never, overlay }), {
    wrapper,
  }).result;
};

beforeEach(() => {
  store = createOrganizerTestStore();
  fake = createTestOrganizerPort();
  overlay = createOrganizerOverlayStore();
  // The command records the option, as the runner does once the change is applied.
  change = vi.fn(async ({ value }) => {
    store.dispatch(setDividersOption(value));
    return { status: "applied" } as unknown as ChangeResult;
  });
});

describe("useOrganizerSection: option", () => {
  it("shows Customize while the scene holds columns, even if the stored option says None", () => {
    store.dispatch(setDividersOption("None"));
    expect(render().current.option).toBe("None");

    record(store, "cab-1", startStateOf("clear-drawer"));
    expect(render().current.option).toBe("Customize");
  });

  it("None with columns clears every cabinet and records the option as one step, with an undo notice (T2)", async () => {
    store.dispatch(setDividersOption("Customize"));
    record(store, "cab-1", startStateOf("clear-drawer"));
    record(store, "cab-2", startStateOf("remove-last"));
    fake.answerNext({
      status: "applied",
      products: [
        { runtimeId: "rt-1", entry: { status: "absent" } },
        { runtimeId: "rt-2", entry: { status: "absent" } },
      ],
      corrections: [],
    });
    const section = render();

    await act(() => section.current.changeOption("None"));

    expect(fake.commands()).toEqual([{ kind: "clear", runtimeIds: ["rt-1", "rt-2"] }]);
    expect(change).toHaveBeenCalledWith({ attributeId: "DividersOption", value: "None", scope: "global" });
    expect(steps(store)).toBe(1);
    expect(organizers(store)).toEqual({});
    expect(section.current.option).toBe("None");
    expect(fake.calls.slice(-2)).toEqual([{ kind: "preview", preview: null }, { kind: "exitView" }]);
    expect(ui(store).notice).toMatchObject({ key: "organizer.cleared", undoHint: true });
  });

  it("keeps the option when the scene could not clear", async () => {
    record(store, "cab-1", startStateOf("clear-drawer"));
    fake.answerNext({ status: "rejected", code: "ORGANIZERS_NOT_READY", message: "not ready" });
    const section = render();

    await act(() => section.current.changeOption("None"));

    expect(change).not.toHaveBeenCalled();
    expect(steps(store)).toBe(0);
    expect(ui(store).notice).toMatchObject({ key: "organizer.placeFailed", undoHint: false });
  });

  it("None without columns only changes the option", async () => {
    store.dispatch(setDividersOption("Customize"));
    const section = render();

    await act(() => section.current.changeOption("None"));

    expect(fake.commands()).toEqual([]);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("Customize opens the one drawer that can take columns (T1, Q-D4), and only then", async () => {
    store.dispatch(setDividersOption("None"));
    const section = render();
    const outOfView = framesFixture.cases.find(({ name }) => name === "out-of-view")!
      .expected as OrganizersOverlayFrame;

    overlay.set({
      ...outOfView,
      entries: outOfView.entries.map((entry) => ({ ...entry, productId: "rt-2", eligible: entry.drawer === "Bot" })),
    });
    await act(() => section.current.changeOption("Customize"));
    expect(fake.calls).toEqual([{ kind: "enterView", address: { runtimeId: "rt-2", drawer: "Bot" } }]);

    overlay.set({
      ...outOfView,
      revision: 2,
      entries: outOfView.entries.map((entry) => ({ ...entry, productId: "rt-2" })),
    });
    await act(() => section.current.changeOption("Customize"));
    expect(fake.calls).toHaveLength(1);
    expect(change).toHaveBeenCalledTimes(2);
  });
});

describe("useOrganizerSection: hint, styles, counter", () => {
  const hintWith = (setUp: () => void) => {
    store.dispatch(setDividersOption("Customize"));
    setUp();
    return render().current.hint;
  };

  it("says when no drawer can take columns", () => {
    expect(
      hintWith(() => store.dispatch(recordDerived({ cabinetKey: "cab-1", drawers: derivedOf("unsupported-width") }))),
    ).toBe("Dividers aren't available for this cabinet size.");
  });

  it.each([
    ["does not exist", { exists: false }],
    ["is not offered by 3D", { offered: false }],
    ["has no room for a column", { capacity: 0 }],
  ])("counts a drawer that %s as one that cannot take columns", (_reason, change) => {
    const editable = derivedOf("sc120-example1").Top;
    const unavailable = { ...editable, ...change };
    const unavailableHint = "Dividers aren't available for this cabinet size.";

    expect(
      hintWith(() =>
        store.dispatch(
          recordDerived({ cabinetKey: "cab-1", drawers: { Top: unavailable, Bot: unavailable } as never }),
        ),
      ),
    ).toBe(unavailableHint);

    // One drawer that can take columns is enough for the section to carry on.
    store.dispatch(recordDerived({ cabinetKey: "cab-1", drawers: { Top: unavailable, Bot: editable } as never }));
    expect(render().current.hint).not.toBe(unavailableHint);
  });

  it("asks to open a drawer outside the view, then follows the drawer in view", () => {
    const derive = () => store.dispatch(recordDerived({ cabinetKey: "cab-1", drawers: derivedOf("sb60-example2") }));

    expect(hintWith(derive)).toBe("Click ‘Open Drawer’ on a drawer to add divider columns.");
    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Top" }));
    expect(render().current.hint).toBe("This drawer is full.");
    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Bot" }));
    expect(render().current.hint).toBe(FIELD.hints.Customize);
  });

  it("offers Metal and shows Oak as not available yet, so the chips stay hidden in v1", () => {
    const section = render().current;

    expect(section.styles.map(({ value, available }) => [value, available])).toEqual([
      ["Metal", true],
      ["Oak", false],
    ]);
    expect(section.styles[1].reason).toBe("Oak organizers are not available yet.");
    expect(section.showStyles).toBe(false);
  });

  it("counts the columns of the drawer in view, and opens or closes the section", () => {
    record(store, "cab-1", startStateOf("clear-drawer"));
    expect(render().current.counter).toBeNull();

    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Bot" }));
    const section = render();
    expect(section.current.counter).toEqual({ columns: 1, drawer: "Bot" });

    act(() => section.current.onSectionToggle(true));
    expect(ui(store).sectionActive).toBe(true);
  });
});
