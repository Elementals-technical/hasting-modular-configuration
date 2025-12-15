export function setConfigBatch(ids: string[] | { productType: string }, config: any) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setConfigBatch = canvasIframe?.ConfiguratorAPI?.setConfigBatch;

  console.log("call setConfigBatch", setConfigBatch);
  console.log("ids", ids);
  console.log("config", config);

  if (!setConfigBatch) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setConfigBatch not ready");
    return null;
  }

  try {
    const payload = Array.isArray(ids) ? { productIds: ids } : ids;

    return setConfigBatch(payload, config);
  } catch (error) {
    console.error("[PlayCanvas] Failed to setConfigBatch", error);
    return null;
  }
}
