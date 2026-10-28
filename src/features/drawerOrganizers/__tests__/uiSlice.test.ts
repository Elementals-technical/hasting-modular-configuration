import { beforeEach, describe, expect, it } from "vitest";

import { store } from "@/app/store";
import { recordOrganizers, resetConfiguration, syncCabinets } from "@/entities/configuration";
import type { DrawerDerived } from "@/entities/configuration/model/drawerOrganizers";
import { setHistoryRestoring } from "@/entities/history/model/store/slice";
import {
  removeProductId,
  reset,
  resetProducts,
  restoreProductState,
  setDividersOption,
  setIsDrawerOpen,
} from "@/entities/product/model/store/slice";

import {
  selectColumnCount,
  selectEffectiveDividersOption,
  selectOrganizerFocus,
  selectOrganizersUi,
  selectViewSet,
} from "../model/store/selectors";
import {
  backToPresets,
  dismissNotice,
  drawerOrganizersUiReducer,
  openEditor,
  pulseSave,
  recordDerived,
  selectColumn,
  setDraft,
  setPanelLayout,
  setPendingStyle,
  setView,
  showNotice,
  type DrawerOrganizersUiState,
} from "../model/store/slice";
import { endStateOf } from "./organizerPortAnswers";

/** `drawerOrganizersUi`: the ephemeral state of the C1 machine; an undo or a restore only drops it. */

const TOP = { cabinetKey: "cab-1", drawer: "Top" as const };
const COLUMN = { ...TOP, slot: 0 };

const apply = (...actions: Parameters<typeof drawerOrganizersUiReducer>[1][]) =>
  actions.reduce<DrawerOrganizersUiState>(
    (state, action) => drawerOrganizersUiReducer(state, action),
    drawerOrganizersUiReducer(undefined, { type: "init" }),
  );

const editing = () => apply(setView(TOP), selectColumn(COLUMN), openEditor([2]), setDraft([2, 4]));

describe("drawerOrganizersUi reducers", () => {
  it("starts closed, outside any view", () => {
    expect(apply()).toMatchObject({ view: null, selected: null, panel: "closed", draft: null, busy: false });
  });

  it("selecting a column opens the presets, null closes the panel; both drop a draft", () => {
    expect(apply(setView(TOP), selectColumn(COLUMN))).toMatchObject({
      selected: COLUMN,
      panel: "presets",
      draft: null,
    });
    expect(apply(setView(TOP), selectColumn(COLUMN), openEditor([2]), selectColumn(null))).toMatchObject({
      selected: null,
      panel: "closed",
      draft: null,
    });
  });

  it("opens the editor on the column's positions, edits the draft, and drops it on Back", () => {
    expect(editing()).toMatchObject({ panel: "editor", draft: [2, 4] });
    expect(drawerOrganizersUiReducer(editing(), backToPresets())).toMatchObject({
      panel: "presets",
      selected: COLUMN,
      draft: null,
    });
    // No editor without a selected column, no draft outside the editor.
    expect(apply(openEditor([2]))).toMatchObject({ panel: "closed", draft: null });
    expect(apply(setView(TOP), selectColumn(COLUMN), setDraft([1]))).toMatchObject({ draft: null });
  });

  it("drops the selection when another drawer comes into view, and keeps it for the same one", () => {
    expect(drawerOrganizersUiReducer(editing(), setView({ ...TOP }))).toMatchObject({ panel: "editor", draft: [2, 4] });
    expect(drawerOrganizersUiReducer(editing(), setView({ ...TOP, drawer: "Bot" }))).toMatchObject({
      view: { cabinetKey: "cab-1", drawer: "Bot" },
      selected: null,
      panel: "closed",
      draft: null,
    });
  });

  it("keeps pending styles and derived state per drawer", () => {
    const derived: DrawerDerived = {
      exists: true,
      offered: true,
      role: "outer",
      profile: null,
      maxSlot: 1,
      capacity: 3,
      count: 0,
      lock: null,
      candidates: [],
      unavailable: null,
    };
    const state = apply(
      setPendingStyle({ address: TOP, style: "Metal" }),
      recordDerived({ cabinetKey: "cab-1", drawers: { Top: derived, Bot: { ...derived, count: 1 } } }),
    );

    expect(state.pendingStyle).toEqual({ "cab-1:Top": "Metal" });
    expect(Object.keys(state.derived)).toEqual(["cab-1:Top", "cab-1:Bot"]);
  });

  it("numbers notices, dismisses only the one shown, and pulses Save", () => {
    const first = apply(showNotice({ key: "organizer.cleared", undoHint: true }));
    const second = drawerOrganizersUiReducer(first, showNotice({ key: "organizer.cleared", undoHint: true }));

    expect(second.notice!.id).not.toBe(first.notice!.id);
    expect(drawerOrganizersUiReducer(second, dismissNotice(first.notice!.id)).notice).toBe(second.notice);
    expect(drawerOrganizersUiReducer(second, dismissNotice(second.notice!.id)).notice).toBeNull();
    expect(apply(pulseSave(), pulseSave()).savePulse).toBe(2);
  });
});

describe("drawerOrganizersUi follows the scene", () => {
  const productState = {
    productIds: [],
    productOptions: store.getState().rootStateUI.product.productOptions,
    activeCabinetType: null,
    selectedDimensions: { width: null, height: null, depth: null },
  };

  it.each([
    ["the drawer closes", setIsDrawerOpen(false)],
    ["a product is removed", removeProductId("rt-1")],
  ])("drops view, selection and draft when %s", (_, action) => {
    expect(drawerOrganizersUiReducer(editing(), action)).toMatchObject({
      view: null,
      selected: null,
      panel: "closed",
      draft: null,
    });
  });

  it("drops derived state and pending styles too when the products are restored or reset", () => {
    const state = drawerOrganizersUiReducer(editing(), setPendingStyle({ address: TOP, style: "Metal" }));

    for (const action of [restoreProductState(productState), resetProducts()]) {
      expect(drawerOrganizersUiReducer(state, action)).toMatchObject({
        view: null,
        draft: null,
        pendingStyle: {},
        derived: {},
      });
    }
  });

  it("an undo or a redo drops the draft but keeps the view (F10)", () => {
    expect(drawerOrganizersUiReducer(editing(), setHistoryRestoring(true))).toMatchObject({
      view: TOP,
      selected: null,
      panel: "closed",
      draft: null,
    });
    expect(drawerOrganizersUiReducer(editing(), setHistoryRestoring(false))).toEqual(editing());
    expect(drawerOrganizersUiReducer(editing(), setIsDrawerOpen(true))).toEqual(editing());
  });
});

describe("drawerOrganizersUi selectors", () => {
  beforeEach(() => {
    store.dispatch(reset());
    store.dispatch(resetConfiguration());
    store.dispatch(resetProducts());
    store.dispatch(syncCabinets(["rt-1"]));
  });

  it("shows Customize while the scene holds columns, otherwise the stored option", () => {
    store.dispatch(setDividersOption("None"));
    expect(selectEffectiveDividersOption(store.getState())).toBe("None");

    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: endStateOf("preset") }));
    expect(selectEffectiveDividersOption(store.getState())).toBe("Customize");

    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: { status: "absent" } }));
    expect(selectEffectiveDividersOption(store.getState())).toBe("None");
  });

  it("reads the set and the column count of the drawer in view", () => {
    store.dispatch(recordOrganizers({ stableKey: "cab-1", entry: endStateOf("clear-drawer") }));
    expect(selectViewSet(store.getState())).toBeNull();
    expect(selectColumnCount(store.getState(), { cabinetKey: "cab-1", drawer: "Bot" })).toBe(1);

    store.dispatch(setView({ cabinetKey: "cab-1", drawer: "Bot" }));
    expect(selectViewSet(store.getState())).toMatchObject({ style: "Metal", columns: [{ slot: 0 }] });
    expect(selectColumnCount(store.getState())).toBe(1);
    expect(selectColumnCount(store.getState(), TOP)).toBe(0);
  });

  it("asks the 3D view to grow only for an open panel on the M1 layout", () => {
    store.dispatch(setView(TOP));
    store.dispatch(selectColumn(COLUMN));
    expect(selectOrganizerFocus(store.getState())).toBe(false);

    store.dispatch(setPanelLayout("m1"));
    expect(selectOrganizerFocus(store.getState())).toBe(true);
    expect(selectOrganizersUi(store.getState()).layout).toBe("m1");
    store.dispatch(setPanelLayout("desktop"));
  });
});
