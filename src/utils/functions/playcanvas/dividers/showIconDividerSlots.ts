export function showIconDividerSlots(cabinetId: string, drawerType: "Top" | "TopFull" | "Bot") {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.showIconDividerSlots;

  console.log("call showIconDividerSlots", apiMethod);
  console.log("cabinetId", cabinetId, "drawerType", drawerType);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.showIconDividerSlots not ready");
    return null;
  }

  try {
    return apiMethod(cabinetId, drawerType);
  } catch (error) {
    console.error("[PlayCanvas] Failed to showIconDividerSlots", error);
    return null;
  }
}
