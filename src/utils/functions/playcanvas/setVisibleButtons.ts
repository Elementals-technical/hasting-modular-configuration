export type VisibleButtonsOptions = {
  /** "Side-Shelf": the scene shows the "+" at the row ends only. */
  productType?: string;
  /**
   * Height / Handle of the cabinet about to be added: the scene keeps only the "+" it may use
   * (Urban Freestanding row rule: tall cabinets stand in one block) and puts them at its height.
   * Must match the Height / Handle sent to setProductByParams for the clicked "+".
   * Without it the scene shows every "+", as before; outside an UF row it changes nothing.
   */
  config?: { Height?: number; Handle?: string };
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
