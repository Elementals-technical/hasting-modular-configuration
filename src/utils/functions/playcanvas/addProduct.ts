export interface addProductConfigI {
  Height: number;
  Depth: number;
  CabinetColor: string;
  Width: number;
  sinkType?: string;
}

// Return product and its ID
export async function addProduct(name: string, config?: addProductConfigI) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addProduct = canvasIframe?.ConfiguratorAPI?.addProduct;

  console.log("call addProduct", addProduct);
  console.log("name", name);

  if (!addProduct) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addProduct not ready");
    return null;
  }

  try {
    const productId = await addProduct(name, config);
    console.log(productId);

    return productId;
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
