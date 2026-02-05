import type { DividerSlotInfo } from "./setOnAddSlotClick";
import type { OccupiedSlotInfo } from "./setOnOccupiedSlotClick";

export type DividerSlotClickInfo = DividerSlotInfo | OccupiedSlotInfo;

export function setDividerSlotClickHandler(callback: (slotInfo: DividerSlotClickInfo) => void) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.setDividerSlotClickHandler;

  console.log("call setDividerSlotClickHandler", apiMethod);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.setDividerSlotClickHandler not ready");
    return null;
  }

  try {
    return apiMethod(callback);
  } catch (error) {
    console.error("[PlayCanvas] Failed to setDividerSlotClickHandler", error);
    return null;
  }
}
