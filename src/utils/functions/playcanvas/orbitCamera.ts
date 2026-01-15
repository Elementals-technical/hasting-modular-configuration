export type OrbitCameraScript = {
  yaw?: number;
  pitch?: number;
  distance?: number;
  pivotPoint?: { x: number; y: number; z: number };
  update?: (dt: number) => void;
  [key: string]: unknown;
};

export type OrbitCameraHandle = {
  app: any;
  cameraEntity: any;
  orbit: OrbitCameraScript;
};

let lastYaw: number | null = null;

export function orbitCamera(): OrbitCameraHandle | null {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const app = canvasIframe?.ConfiguratorAPI?.config;

  if (!app) {
    console.warn("[PlayCanvas] ConfiguratorAPI.config not ready");
    return null;
  }

  const cameraEntity = app.root?.findByName?.("Camera") || app.root?.findComponent?.("camera")?.entity;
  const orbit = cameraEntity?.script?.orbitCamera;

  if (!orbit) {
    console.warn("[PlayCanvas] Orbit camera not ready");
    return null;
  }

  return { app, cameraEntity, orbit };
}

export function isOrbitCameraRotating(threshold = 0.1): boolean {
  const handle = orbitCamera();
  if (!handle) return false;

  const getEulerAngles = handle.cameraEntity?.getEulerAngles;
  if (typeof getEulerAngles !== "function") {
    console.warn("[PlayCanvas] Camera entity does not expose getEulerAngles()");
    return false;
  }

  const yaw = getEulerAngles.call(handle.cameraEntity).y as number;
  if (typeof yaw !== "number") {
    console.warn("[PlayCanvas] Camera yaw is not a number");
    return false;
  }

  if (lastYaw === null) {
    lastYaw = yaw;
    return false;
  }

  const diff = Math.abs(yaw - lastYaw);
  const normalizedDiff = Math.min(diff, 360 - diff);
  lastYaw = yaw;

  return normalizedDiff > threshold;
}

export function resetOrbitRotationTracker() {
  lastYaw = null;
}
