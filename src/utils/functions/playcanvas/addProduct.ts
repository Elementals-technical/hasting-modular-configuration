// Return product and its ID
export async function addProduct(name: string) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addProduct = canvasIframe?.ConfiguratorAPI?.addProduct;

  if (!addProduct) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addProduct not ready");
    return null;
  }

  try {
    const productId = await addProduct(name);
    console.log(productId);

    return productId;
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
