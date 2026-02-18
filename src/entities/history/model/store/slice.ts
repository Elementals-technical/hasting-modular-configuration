import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { HandleOption } from "@/entities/product/model/store/slice";

export type SceneSnapshot = {
  productIds: string[];
  productConfigs: Record<string, Record<string, unknown>>;
  productOptions: {
    CabinetColor: string;
    CabinetColorSku: string;
    CabinetColorMaterial: string;
    CabinetColorFinish: string;
    sinkType: string;
    CountertopColor: string;
    CountertopColorSku: string;
    HandleGrooveColor: string;
    HandleGrooveColorSku: string;
    Handle: HandleOption;
    Thickness: string;
    DrawerPanelFluting: string;
    GrainDirection: string;
    BookMatching: string;
    CountertopStyle: string;
    SidePanels: string;
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
};

type HistoryState = {
  past: SceneSnapshot[];
  future: SceneSnapshot[];
};

const MAX_HISTORY_SIZE = 30;

const initialState: HistoryState = {
  past: [],
  future: [],
};

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    pushSnapshot(state, action: PayloadAction<SceneSnapshot>) {
      state.past.push(action.payload);
      if (state.past.length > MAX_HISTORY_SIZE) {
        state.past.shift();
      }
      state.future = [];
    },
    undo(state, action: PayloadAction<SceneSnapshot>) {
      const previous = state.past.pop();
      if (!previous) return;
      state.future.push(action.payload);
    },
    redo(state, action: PayloadAction<SceneSnapshot>) {
      const next = state.future.pop();
      if (!next) return;
      state.past.push(action.payload);
    },
    clearHistory() {
      return initialState;
    },
  },
});

export const { pushSnapshot, undo, redo, clearHistory } = historySlice.actions;
export const historyReducer = historySlice.reducer;
