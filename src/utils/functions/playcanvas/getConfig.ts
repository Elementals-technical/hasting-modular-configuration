export async function getConfig(productId: string) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const getConfig = canvasIframe?.ConfiguratorAPI?.getConfig;

  if (!getConfig) {
    console.warn("[PlayCanvas] ConfiguratorAPI.getConfig not ready");
    return null;
  }

  try {
    return await getConfig(productId);
  } catch (error) {
    console.error("[PlayCanvas] Failed to get config", error);
    return null;
  }
}
