import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConfigurationSnapshot, SceneLayout, StableCabinetKey } from "@/entities/configuration";
import type { HandleOption, PlacedDivider } from "@/entities/product/model/store/slice";
import type { PresetProduct } from "@/entities/product/types";

export type SceneSnapshot = {
  productIds: string[];
  productConfigs: Record<string, Record<string, unknown>>;
  /** Stable key of each product by runtime id, so undo gives rebuilt products their keys back. */
  cabinetKeys?: Record<string, StableCabinetKey>;
  /** Scoped choices at capture time; absent on snapshots created by older clients. */
  configuration?: ConfigurationSnapshot;
  /** Where the products stood, for collections whose cabinets stand in rows; absent otherwise. */
  sceneLayout?: SceneLayout;
  productsPresets?: PresetProduct[];
  productOptions: {
    CabinetColor: string;
    CabinetColorSku: string;
    CabinetColorMaterial: string;
    CabinetColorFinish: string;
    sinkType: string;
    CountertopColor: string;
    CountertopColorSku: string;
    VesselColor: string;
    HandleGrooveColor: string;
    HandleGrooveColorSku: string;
    Handle: HandleOption;
    Thickness: string;
    DrawerPanelFluting: string;
    GrainDirection: string;
    BookMatching: string;
    CountertopStyle: string;
    SidePanels: string;
    SidePanelLeft: "active" | "none" | "auto-removed";
    SidePanelRight: "active" | "none" | "auto-removed";
    LedOption: string;
    DividersOption: string;
    DividersStyle: string;
    TowelBarOption: string;
    TowelBarColor: string;
    FaucetHolesAmount: string;
    FaucetHolesSpacing: string;
  };
  activeCabinetType: string | null;
  selectedDimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
  placedDividers?: PlacedDivider[];
  selectedProductConfig?: Record<string, unknown> | null;
  placedCabinetStyles?: Record<string, string>;
};

type HistoryState = {
  past: SceneSnapshot[];
  future: SceneSnapshot[];
  isRestoring: boolean;
  /** An edit is open on the scene (a cabinet draft, a countertop being moved): undo and redo wait. */
  isBlocked: boolean;
};

const MAX_HISTORY_SIZE = 30;

const isEmptyComposition = (snapshot: SceneSnapshot): boolean => snapshot.productIds.length === 0;

const initialState: HistoryState = {
  past: [],
  future: [],
  isRestoring: false,
  isBlocked: false,
};

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    pushSnapshot(state, action: PayloadAction<SceneSnapshot>) {
      if (state.isRestoring) return;
      // An empty composition cannot be restored (the scene restorer refuses it), so the history
      // starts over from it: after the first cabinet there is nothing to undo. A list is replaced
      // only when it changes, so a step still open elsewhere does not read as out of date.
      if (isEmptyComposition(action.payload)) {
        if (state.past.length > 0) state.past = [];
        if (state.future.length > 0) state.future = [];
        return;
      }
      state.past.push(action.payload);
      if (state.past.length > MAX_HISTORY_SIZE) {
        state.past.shift();
      }
      if (state.future.length > 0) state.future = [];
    },
    undo(state, action: PayloadAction<SceneSnapshot>) {
      const previous = state.past.pop();
      if (!previous) return;
      // The state left behind is kept for redo, unless it is an empty composition.
      if (!isEmptyComposition(action.payload)) state.future.push(action.payload);
    },
    redo(state, action: PayloadAction<SceneSnapshot>) {
      const next = state.future.pop();
      if (!next) return;
      if (!isEmptyComposition(action.payload)) state.past.push(action.payload);
    },
    clearHistory(state) {
      // The open edit is a fact about the scene, not about the entries: it outlives them.
      return { ...initialState, isBlocked: state.isBlocked };
    },
    setHistoryRestoring(state, action: PayloadAction<boolean>) {
      state.isRestoring = action.payload;
    },
    setHistoryBlocked(state, action: PayloadAction<boolean>) {
      state.isBlocked = action.payload;
    },
  },
});

export const { pushSnapshot, undo, redo, clearHistory, setHistoryRestoring, setHistoryBlocked } = historySlice.actions;
export const historyReducer = historySlice.reducer;
