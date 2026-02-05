import type { DividerSlotInfo } from "./setOnAddSlotClick";

export type DividerSlotKey = Pick<DividerSlotInfo, "cabinetId" | "drawerType" | "zone" | "key">;

export function getAvailableDividerTypes(slot: DividerSlotKey) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.getAvailableDividerTypes;

  console.log("call getAvailableDividerTypes", apiMethod);
  console.log("slot", slot);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.getAvailableDividerTypes not ready");
    return null;
  }

  try {
    return apiMethod(slot);
  } catch (error) {
    console.error("[PlayCanvas] Failed to getAvailableDividerTypes", error);
    return null;
  }
}
