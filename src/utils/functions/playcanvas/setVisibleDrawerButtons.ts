export function setVisibleDrawerButtons(isEnabled: boolean) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setVisibleDrawerButtons =
    canvasIframe?.ConfiguratorAPI?.setVisibleDrawerButtons;

  console.log("call setVisibleDrawerButtons", setVisibleDrawerButtons);
  console.log("isEnabled setVisibleDrawerButtons", isEnabled);

  if (!setVisibleDrawerButtons) {
    console.warn(
      "[PlayCanvas] ConfiguratorAPI.setVisibleDrawerButtons not ready"
    );
    return null;
  }

  try {
    setVisibleDrawerButtons(isEnabled);
  } catch (error) {
    console.error(
      "[PlayCanvas] Failed to set setVisibleDrawerButtons",
      error
    );
    return null;
  }
}
