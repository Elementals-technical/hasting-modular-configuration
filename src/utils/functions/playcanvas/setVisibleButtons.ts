type VisibleButtonsOptions = {
  productType?: string;
};

export function setVisibleButtons(isEnabled: boolean, options?: VisibleButtonsOptions) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setVisibleButtons = canvasIframe?.ConfiguratorAPI?.setVisibleButtons;

  console.log("call setVisibleButtons", setVisibleButtons);
  console.log("isEnabled setVisibleButtons", isEnabled);
  console.log("options setVisibleButtons", options);

  if (!setVisibleButtons) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setVisibleButtons not ready");
    return null;
  }

  try {
    setVisibleButtons(isEnabled, options);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set setVisibleButtons", error);
    return null;
  }
}
