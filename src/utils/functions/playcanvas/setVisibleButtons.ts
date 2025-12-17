export function setVisibleButtons(isEnabled: boolean) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setVisibleButtons = canvasIframe?.ConfiguratorAPI?.setVisibleButtons;

  console.log("call setVisibleButtons", setVisibleButtons);
  console.log("isEnabled setVisibleButtons", isEnabled);

  if (!setVisibleButtons) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setVisibleButtons not ready");
    return null;
  }

  try {
    setVisibleButtons(isEnabled);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set setVisibleButtons", error);
    return null;
  }
}
