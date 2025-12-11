export const addProductByRight = async (name: string) => {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addProductToRight = canvasIframe?.ConfiguratorAPI?.addProductByRight;

  console.log("call addProductToRight", addProductToRight);
  console.log("name", name);

  if (!addProductToRight) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addProductByRight not ready");
    return null;
  }

  try {
    const productId = await addProductToRight(name);
    console.log(productId);

    return productId;
  } catch (error) {
    console.error("[PlayCanvas] Failed to add product to the right", error);
    return null;
  }
};
