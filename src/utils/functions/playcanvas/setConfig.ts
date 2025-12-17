export async function setConfig(id: string | null, config: any) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const setConfig = canvasIframe?.ConfiguratorAPI?.setConfig;

  console.log("call setConfig", setConfig);
  console.log("id", id);
  console.log("config", config);

  if (!setConfig) {
    console.warn("[PlayCanvas] ConfiguratorAPI.setConfig not ready");
    return null;
  }

  try {
    await setConfig(id, config);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set setConfig", error);
    return null;
  }
}
