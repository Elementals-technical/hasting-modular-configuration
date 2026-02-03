import type { DividerSlotInfo } from "./setOnAddSlotClick";

export async function placeDividerToSlot(slotInfo: DividerSlotInfo, type: "A" | "B" | "C") {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.placeDividerToSlot;

  console.log("call placeDividerToSlot", apiMethod);
  console.log("slotInfo", slotInfo, "type", type);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.placeDividerToSlot not ready");
    return null;
  }

  try {
    return await apiMethod(slotInfo, type);
  } catch (error) {
    console.error("[PlayCanvas] Failed to placeDividerToSlot", error);
    return null;
  }
}
