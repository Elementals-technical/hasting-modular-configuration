import { setSidePanel } from "./sidePanels";

export async function resetSidePanels() {
  await setSidePanel("None", "both");
}
