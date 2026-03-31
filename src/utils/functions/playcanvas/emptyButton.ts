function getEmptyButtonAPI() {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  return canvasIframe?.ConfiguratorAPI as
    | { showEmptyButton?: () => void; hideEmptyButton?: () => void }
    | undefined;
}

export function showEmptyButton() {
  const api = getEmptyButtonAPI();
  if (!api?.showEmptyButton) {
    console.warn("[PlayCanvas] ConfiguratorAPI.showEmptyButton not ready");
    return;
  }
  try {
    api.showEmptyButton();
  } catch (error) {
    console.error("[PlayCanvas] Failed to call showEmptyButton", error);
  }
}

export function hideEmptyButton() {
  const api = getEmptyButtonAPI();
  if (!api?.hideEmptyButton) {
    console.warn("[PlayCanvas] ConfiguratorAPI.hideEmptyButton not ready");
    return;
  }
  try {
    api.hideEmptyButton();
  } catch (error) {
    console.error("[PlayCanvas] Failed to call hideEmptyButton", error);
  }
}
