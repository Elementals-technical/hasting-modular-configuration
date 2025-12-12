export function swapProducts(idA: string, idB: string) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const swapProducts = canvasIframe?.ConfiguratorAPI?.swapProducts;

  console.log("call swapProducts", swapProducts);
  console.log("idA, idB", idA, idB);

  if (!swapProducts) {
    console.warn("[PlayCanvas] ConfiguratorAPI.swapProducts not ready");
    return null;
  }

  try {
    swapProducts(idA, idB);
  } catch (error) {
    console.error("[PlayCanvas] Failed to swapProducts", error);
    return null;
  }
}
