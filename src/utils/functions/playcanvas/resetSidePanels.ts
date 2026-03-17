import { setConfigBatch } from "./setConfigBatch";

export async function resetSidePanels() {
  await setConfigBatch({}, { SidePanel: "None", SidePanelSide: "both" });
}
