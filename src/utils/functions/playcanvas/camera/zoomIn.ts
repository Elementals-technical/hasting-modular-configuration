export function zoomIn(step?: number) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const zoomIn = canvasIframe?.ConfiguratorAPI?.camera?.zoomIn;

  console.log("call zoomIn", zoomIn);
  console.log("step zoomIn", step);

  if (!zoomIn) {
    console.warn("[PlayCanvas] ConfiguratorAPI.camera.zoomIn not ready");
    return null;
  }

  try {
    return zoomIn(step);
  } catch (error) {
    console.error("[PlayCanvas] Failed to zoom in", error);
    return null;
  }
}
