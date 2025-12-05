export async function addProduct(id: string) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const removeProduct = canvasIframe?.ConfiguratorAPI?.removeProduct;

  if (!removeProduct) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addProduct not ready");
    return null;
  }

  try {
    return await removeProduct(id);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
