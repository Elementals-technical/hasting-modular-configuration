type ButtonSide = "left" | "right";

type ButtonClickHandler = (entityId: string, side: ButtonSide) => void | Promise<void>;

export function setHandleButtonClick(callback: ButtonClickHandler) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const apiSetHandleButtonClick = canvasIframe?.ConfiguratorAPI?.setHandleButtonClick;

  if (!apiSetHandleButtonClick) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setHandleButtonClick not ready");
    return;
  }

  try {
    apiSetHandleButtonClick(callback);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set handle button click callback", error);
  }
}
