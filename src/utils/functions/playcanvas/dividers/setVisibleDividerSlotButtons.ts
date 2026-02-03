export function setVisibleDividerSlotButtons(visible: boolean) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const apiMethod = canvasIframe?.ConfiguratorAPI?.setVisibleDividerSlotButtons;

  console.log("call setVisibleDividerSlotButtons", apiMethod);
  console.log("visible", visible);

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setVisibleDividerSlotButtons not ready");
    return null;
  }

  try {
    return apiMethod(visible);
  } catch (error) {
    console.error("[PlayCanvas] Failed to setVisibleDividerSlotButtons", error);
    return null;
  }
}
