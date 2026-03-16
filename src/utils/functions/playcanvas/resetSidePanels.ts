import { getEdgeCabinets } from "./getEdgeCabinets";
import { setConfigBatch } from "./setConfigBatch";

export async function resetSidePanels() {
  const { leftCabinetId, rightCabinetId } = getEdgeCabinets();
  const edgeIds = [leftCabinetId, rightCabinetId].filter(Boolean) as string[];

  if (!edgeIds.length) {
    // Fallback for cases where edge cabinet IDs are temporarily unavailable.
    await setConfigBatch({ productType: "SidePanel" }, { SidePanel: "None" });
    return;
  }

  await Promise.all(edgeIds.map((cabinetId) => setConfigBatch({ cabinetId }, { SidePanel: "None" })));
}

