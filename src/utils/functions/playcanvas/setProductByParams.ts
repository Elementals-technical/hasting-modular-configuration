export type SetProductByParamsSide = "left" | "right";

export async function setProductByParams(type: string, entityName: string | null, side: SetProductByParamsSide) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setProductByParams = canvasIframe?.ConfiguratorAPI?.setProductByParams;

  console.log("call setProductByParams", setProductByParams);
  console.log("type", type);
  console.log("prevEntityId", entityName);
  console.log("side", side);

  if (!setProductByParams) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setProductByParams not ready");
    return null;
  }

  try {
    const productId = await setProductByParams(type, entityName, side);
    console.log(productId);

    return productId;
  } catch (error) {
    console.error("[PlayCanvas] Failed to set product by params", error);
    return null;
  }
}
