import { setConfigBatch } from "../setConfigBatch";
import type { OccupiedSlotInfo } from "./setOnOccupiedSlotClick";

export async function removeDividerFromSlot(slotInfo: OccupiedSlotInfo) {
  console.log("call removeDividerFromSlot", slotInfo);

  try {
    return await setConfigBatch(
      {
        cabinetId: slotInfo.cabinetId,
        drawerType: slotInfo.drawerType,
        zone: slotInfo.zone,
        key: slotInfo.key,
      } as any,
      { value: "empty" },
    );
  } catch (error) {
    console.error("[PlayCanvas] Failed to removeDividerFromSlot", error);
    return null;
  }
}
