export function zoomOut(step?: number) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const zoomOut = canvasIframe?.ConfiguratorAPI?.camera?.zoomOut;

  console.log("call zoomOut", zoomOut);
  console.log("step zoomOut", step);

  if (!zoomOut) {
    console.warn("[PlayCanvas] ConfiguratorAPI.camera.zoomOut not ready");
    return null;
  }

  try {
    return zoomOut(step);
  } catch (error) {
    console.error("[PlayCanvas] Failed to zoom out", error);
    return null;
  }
}
