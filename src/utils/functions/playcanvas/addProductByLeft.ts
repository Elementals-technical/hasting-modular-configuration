export const addProductByLeft = async (name: string) => {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addProductToLeft = canvasIframe?.ConfiguratorAPI?.addProductByLeft;

  console.log("call addProductToLeft", addProductToLeft);
  console.log("name", name);

  if (!addProductToLeft) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addProductByLeft not ready");
    return null;
  }

  try {
    const productId = await addProductToLeft(name);
    console.log(productId);

    return productId;
  } catch (error) {
    console.error("[PlayCanvas] Failed to add product to the left", error);
    return null;
  }
};
