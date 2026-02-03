export type OccupiedSlotInfo = {
  cabinetId: string;
  drawerType: "Top" | "Bot";
  zone: string;
  key: string;
  isOccupied: boolean;
  stateId: string;
  dividerType: string;
  zoneIndex: number;
  position?: {
    start: number;
    center: number;
    end: number;
  };
  slot?: unknown;
};

export function setOnOccupiedSlotClick(callback: (slotInfo: OccupiedSlotInfo) => void) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.setOnOccupiedSlotClick;

  console.log("call setOnOccupiedSlotClick", apiMethod);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.setOnOccupiedSlotClick not ready");
    return null;
  }

  try {
    return apiMethod(callback);
  } catch (error) {
    console.error("[PlayCanvas] Failed to setOnOccupiedSlotClick", error);
    return null;
  }
}
