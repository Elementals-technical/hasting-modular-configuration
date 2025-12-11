export async function removeProduct(id: string) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const removeProduct = canvasIframe?.ConfiguratorAPI?.removeProduct;

  console.log("call removeProduct", removeProduct);
  console.log("id", id);

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
