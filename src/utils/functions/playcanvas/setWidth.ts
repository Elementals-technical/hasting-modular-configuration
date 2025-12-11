export async function setWidth(productId: string, width: number) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setConfig = canvasIframe?.ConfiguratorAPI?.setConfig || canvasIframe?.setConfig;

  console.log("call setWidth", setWidth);
  console.log("productId", productId);
  console.log("width", width);

  if (!setConfig) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setConfig not ready");
    return null;
  }

  try {
    return await setConfig(productId, { width });
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
