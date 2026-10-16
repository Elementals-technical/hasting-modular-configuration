import type { ScenePlus, ScenePlusKind } from "./sceneBridge";

/**
 * The scene calls it with the cabinet the "+" stands by and the "+"'s kind; a row that holds
 * columns (Urban Duplex) also passes the "+" itself.
 */
type ButtonClickHandler = (entityId: string, kind: ScenePlusKind, plus?: ScenePlus) => void | Promise<void>;

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
