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

async function setSidePanelMulti(type: string, side: SidePanelSide) {
  if (type === "None" && side === "both") {
    await setConfigBatch({}, { SidePanel: "None", SidePanelSide: "left" });
    await setConfigBatch({}, { SidePanel: "None", SidePanelSide: "right" });
  } else {
    await setConfigBatch({}, { SidePanel: type, SidePanelSide: side });
  }
}

export const setSidePanel = async (type: string, side: SidePanelSide = "both", cabinetCount?: number) => {
  // Always use the explicit SidePanelSide API — never the legacy no-side `{ SidePanel }`
  // call, which makes PlayCanvas fall back through `cabinetId` and silently resolve a
  // non-edge cabinet to "both". A single cabinet is both edges, so force "both".
  const effectiveSide: SidePanelSide = cabinetCount === 1 ? "both" : side;
  await setSidePanelMulti(type, effectiveSide);
  applyState(type, effectiveSide);
};
