import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { DrawerDerived, DrawerName } from "@/entities/configuration/model/drawerOrganizers";
import { setHistoryRestoring } from "@/entities/history/model/store/slice";
import {
  removeProductId,
  resetProducts,
  restoreProductState,
  setIsDrawerOpen,
} from "@/entities/product/model/store/slice";

import {
  organizerDrawerKey,
  type ColumnAddress,
  type OrganizerAddress,
  type OrganizerDrawerKey,
  type PanelMode,
} from "../types";

/**
 * Ephemeral UI state of the Ph2 drawer organizers (C1 §1): which drawer is in view, which column is
 * selected, the panel and its draft, the style chosen for an empty drawer, what 3D derived for each drawer,
 * and the notice to show. Never persisted and not in the history fingerprint: the scene owns the columns
 * (`configuration.organizersByCabinet`), so an undo or a restore only has to drop what this slice points at.
 */

export type OrganizerPanelLayout = "desktop" | "m1" | "m2";

export type OrganizerNotice = { id: number; key: string; params?: Record<string, number>; undoHint: boolean };

export type DrawerOrganizersUiState = {
  /** The Drawer Dividers section is open on the page. */
  sectionActive: boolean;
  /** The drawer 3D shows from the top (from the `view` event). */
  view: OrganizerAddress | null;
  selected: ColumnAddress | null;
  panel: PanelMode;
  /** Positions in the editor, shown as a preview only. */
  draft: number[] | null;
  /** Style for a drawer without columns yet: the first column takes it. */
  pendingStyle: Partial<Record<OrganizerDrawerKey, string>>;
  derived: Partial<Record<OrganizerDrawerKey, DrawerDerived>>;
  /** A command is running: one click at a time, for every control. */
  busy: boolean;
  /** Grows when Save should draw attention (a click outside the editor). */
  savePulse: number;
  layout: OrganizerPanelLayout;
  notice: OrganizerNotice | null;
};

const initialState: DrawerOrganizersUiState = {
  sectionActive: false,
  view: null,
  selected: null,
  panel: "closed",
  draft: null,
  pendingStyle: {},
  derived: {},
  busy: false,
  savePulse: 0,
  layout: "desktop",
  notice: null,
};

const sameAddress = (a: OrganizerAddress | null, b: OrganizerAddress | null) =>
  a?.cabinetKey === b?.cabinetKey && a?.drawer === b?.drawer;

/** Nothing selected and nothing being edited: the panel is closed. */
const dropSelection = (state: DrawerOrganizersUiState) => {
  state.selected = null;
  state.draft = null;
  state.panel = "closed";
};

/** The drawer in view closed, or the scene it was in is gone. */
const dropView = (state: DrawerOrganizersUiState) => {
  state.view = null;
  dropSelection(state);
};

// Notice ids only have to differ from the last one, so the toast restarts even for the same text.
let lastNoticeId = 0;

const drawerOrganizersUiSlice = createSlice({
  name: "drawerOrganizersUi",
  initialState,
  reducers: {
    setSectionActive(state, action: PayloadAction<boolean>) {
      state.sectionActive = action.payload;
    },

    /** Another drawer (or none) in view: the selection belonged to the old one. */
    setView(state, action: PayloadAction<OrganizerAddress | null>) {
      if (sameAddress(state.view, action.payload)) return;
      state.view = action.payload;
      dropSelection(state);
    },

    /** A column selected shows the preset list; null closes the panel. Any draft is dropped. */
    selectColumn(state, action: PayloadAction<ColumnAddress | null>) {
      state.selected = action.payload;
      state.draft = null;
      state.panel = action.payload ? "presets" : "closed";
    },

    /** The editor opens on the selected column's positions. */
    openEditor(state, action: PayloadAction<number[]>) {
      if (!state.selected) return;
      state.panel = "editor";
      state.draft = [...action.payload];
    },

    setDraft(state, action: PayloadAction<number[]>) {
      if (state.panel === "editor") state.draft = [...action.payload];
    },

    /** Back from the editor: the draft is dropped, the column stays selected. */
    backToPresets(state) {
      if (!state.selected) return;
      state.panel = "presets";
      state.draft = null;
    },

    setPendingStyle(state, action: PayloadAction<{ address: OrganizerAddress; style: string }>) {
      state.pendingStyle[organizerDrawerKey(action.payload.address)] = action.payload.style;
    },

    /** What 3D derived for the drawers of one cabinet (zone, candidates, why a drawer takes none). */
    recordDerived(
      state,
      action: PayloadAction<{ cabinetKey: string; drawers: Partial<Record<DrawerName, DrawerDerived>> }>,
    ) {
      const { cabinetKey, drawers } = action.payload;
      for (const [drawer, derived] of Object.entries(drawers) as [DrawerName, DrawerDerived][]) {
        state.derived[organizerDrawerKey({ cabinetKey, drawer })] = derived;
      }
    },

    setBusy(state, action: PayloadAction<boolean>) {
      state.busy = action.payload;
    },

    pulseSave(state) {
      state.savePulse += 1;
    },

    setPanelLayout(state, action: PayloadAction<OrganizerPanelLayout>) {
      state.layout = action.payload;
    },

    showNotice: {
      reducer(state, action: PayloadAction<OrganizerNotice>) {
        state.notice = action.payload;
      },
      prepare(notice: Omit<OrganizerNotice, "id">) {
        lastNoticeId += 1;
        return { payload: { ...notice, id: lastNoticeId } };
      },
    },

    /** Closes the notice only if it is still the one shown. */
    dismissNotice(state, action: PayloadAction<number>) {
      if (state.notice?.id === action.payload) state.notice = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(setIsDrawerOpen, (state, action) => {
        if (!action.payload) dropView(state);
      })
      .addCase(removeProductId, dropView)
      .addCase(restoreProductState, (state) => {
        dropView(state);
        state.derived = {};
        state.pendingStyle = {};
      })
      .addCase(resetProducts, (state) => {
        dropView(state);
        state.derived = {};
        state.pendingStyle = {};
      })
      // An undo or a redo rebuilds the scene from its snapshot: the draft is dropped, never written (F10).
      .addCase(setHistoryRestoring, (state, action) => {
        if (action.payload) dropSelection(state);
      });
  },
});

export const {
  setSectionActive,
  setView,
  selectColumn,
  openEditor,
  setDraft,
  backToPresets,
  setPendingStyle,
  recordDerived,
  setBusy,
  pulseSave,
  setPanelLayout,
  showNotice,
  dismissNotice,
} = drawerOrganizersUiSlice.actions;

export const drawerOrganizersUiReducer = drawerOrganizersUiSlice.reducer;
