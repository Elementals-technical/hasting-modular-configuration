import { setConfigBatch } from "./setConfigBatch";

export type SidePanelSide = "left" | "right" | "both";

type SidePanelState = {
  left: string;
  right: string;
};

const state: SidePanelState = {
  left: "None",
  right: "None",
};

const applyState = (type: string, side: SidePanelSide) => {
  if (side === "both") {
    state.left = type;
    state.right = type;
    return;
  }

  state[side] = type;
};

export const rememberSidePanelSelection = (type: string, side: SidePanelSide = "both") => {
  applyState(type, side);
};

export const getRememberedSidePanels = (): SidePanelState => ({ ...state });

export const setSidePanel = async (type: string, side: SidePanelSide = "both") => {
  const caller = new Error().stack?.split("\n").slice(1, 5).map((l) => l.trim()).join("\n") ?? "";
  const entry = { t: Date.now(), action: "setSidePanel", type, side, caller };
  console.warn("[SP]", entry.action, type, side);
  ((window as unknown as Record<string, unknown>).__SP_LOG__ as unknown[]) ??= [];
  ((window as unknown as Record<string, unknown>).__SP_LOG__ as unknown[]).push(entry);
  await setConfigBatch({}, { SidePanel: type, SidePanelSide: side });
  applyState(type, side);
};

