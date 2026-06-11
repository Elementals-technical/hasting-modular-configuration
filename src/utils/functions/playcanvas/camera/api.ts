type GenericFn = (...args: any[]) => any;

const getCameraApi = () => {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  return canvasIframe?.ConfiguratorAPI?.camera as Record<string, unknown> | undefined;
};

export function getCameraMethod<T extends GenericFn>(methodName: string): T | null {
  const cameraApi = getCameraApi();

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

export function waitForCameraMethod<T extends GenericFn>(methodName: string, timeoutMs = 20_000): Promise<T | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const tick = () => {
      const cameraApi = getCameraApi();
      const method = cameraApi?.[methodName];

      if (typeof method === "function") {
        resolve(method.bind(cameraApi) as T);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        console.warn(`[PlayCanvas] ConfiguratorAPI.camera.${methodName} not ready`);
        resolve(null);
        return;
      }

      window.setTimeout(tick, 50);
    };

    tick();
  });
}
