export async function removeAllProducts() {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const removeProducts = canvasIframe?.ConfiguratorAPI?.removeAllProduct;

  console.log("call removeAllProducts", removeProducts);

  if (!removeProducts) {
    console.warn("[PlayCanvas] ConfiguratorAPI.removeProducts not ready");
    return null;
  }

  try {
    await removeProducts();
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
