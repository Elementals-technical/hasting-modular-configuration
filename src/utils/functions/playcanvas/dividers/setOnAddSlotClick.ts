export type DividerSlotInfo = {
  cabinetId: string;
  drawerType: "Top" | "Bot";
  zone: string;
  key: string;
  availableTypes: string[];
  position?: {
    start: number;
    center: number;
    end: number;
  };
  slot?: unknown;
};

export function setOnAddSlotClick(callback: (slotInfo: DividerSlotInfo) => void) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.setOnAddSlotClick;

  console.log("call setOnAddSlotClick", apiMethod);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.setOnAddSlotClick not ready");
    return null;
  }

  try {
    return apiMethod(callback);
  } catch (error) {
    console.error("[PlayCanvas] Failed to setOnAddSlotClick", error);
    return null;
  }
}
