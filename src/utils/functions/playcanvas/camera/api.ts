type GenericFn = (...args: any[]) => any;

export function getCameraMethod<T extends GenericFn>(methodName: string): T | null {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const cameraApi = canvasIframe?.ConfiguratorAPI?.camera as Record<string, unknown> | undefined;

  if (!cameraApi) {
    console.warn("[PlayCanvas] ConfiguratorAPI.camera not ready");
    return null;
  }

  const method = cameraApi[methodName];
  if (typeof method !== "function") {
    console.warn(`[PlayCanvas] ConfiguratorAPI.camera.${methodName} not ready`);
    return null;
  }

  return method.bind(cameraApi) as T;
}
