export async function addPreset(presetProducts: any) {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;

  const addPreset = canvasIframe?.ConfiguratorAPI?.presetProducts;

  if (!addPreset) {
    console.warn("[PlayCanvas] ConfiguratorAPI.addPreset not ready");
    return null;
  }

  try {
    const presets = await addPreset(presetProducts);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set width", error);
    return null;
  }
}
