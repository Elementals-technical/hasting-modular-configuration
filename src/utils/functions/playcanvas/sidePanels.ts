export type SidePanelSide = "left" | "right" | "both";

type SidePanelState = {
  left: string;
  right: string;
};

/**
 * The side panels the scene last took, per side. The side panel port records every placement
 * the scene took; the eligibility check and the full dimensions read it back.
 */
const state: SidePanelState = {
  left: "None",
  right: "None",
};

export const rememberSidePanelSelection = (type: string, side: SidePanelSide = "both") => {
  if (side === "both") {
    state.left = type;
    state.right = type;
    return;
  }

  state[side] = type;
};

export const getRememberedSidePanels = (): SidePanelState => ({ ...state });
