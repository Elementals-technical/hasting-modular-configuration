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

export type OrbitCameraState = {
  yaw?: number;
  pitch?: number;
  distance?: number;
  targetYaw?: number;
  targetPitch?: number;
  targetDistance?: number;
  pivotPoint?: { x: number; y: number; z: number };
  targetPivotPoint?: { x: number; y: number; z: number };
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

const readVec3 = (value: unknown): { x: number; y: number; z: number } | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const vec = value as { x?: unknown; y?: unknown; z?: unknown };
  if (typeof vec.x !== "number" || typeof vec.y !== "number" || typeof vec.z !== "number") return undefined;
  return { x: vec.x, y: vec.y, z: vec.z };
};

const applyVec3 = (target: unknown, source: { x: number; y: number; z: number } | undefined) => {
  if (!target || !source || typeof target !== "object") return;
  const vec = target as { x?: number; y?: number; z?: number; set?: (x: number, y: number, z: number) => void };
  if (typeof vec.set === "function") {
    vec.set(source.x, source.y, source.z);
    return;
  }
  vec.x = source.x;
  vec.y = source.y;
  vec.z = source.z;
};

export function captureOrbitCameraState(): OrbitCameraState | null {
  const handle = orbitCamera();
  if (!handle) return null;

  const orbit = handle.orbit as Record<string, unknown>;

  return {
    yaw: typeof orbit.yaw === "number" ? orbit.yaw : undefined,
    pitch: typeof orbit.pitch === "number" ? orbit.pitch : undefined,
    distance: typeof orbit.distance === "number" ? orbit.distance : undefined,
    targetYaw: typeof orbit.targetYaw === "number" ? orbit.targetYaw : undefined,
    targetPitch: typeof orbit.targetPitch === "number" ? orbit.targetPitch : undefined,
    targetDistance: typeof orbit.targetDistance === "number" ? orbit.targetDistance : undefined,
    pivotPoint: readVec3(orbit.pivotPoint),
    targetPivotPoint: readVec3(orbit.targetPivotPoint),
  };
}

export function restoreOrbitCameraState(state: OrbitCameraState | null | undefined) {
  if (!state) return;
  const handle = orbitCamera();
  if (!handle) return;

  const orbit = handle.orbit as Record<string, unknown>;

  if (typeof state.yaw === "number") orbit.yaw = state.yaw;
  if (typeof state.pitch === "number") orbit.pitch = state.pitch;
  if (typeof state.distance === "number") orbit.distance = state.distance;
  if (typeof state.targetYaw === "number") orbit.targetYaw = state.targetYaw;
  if (typeof state.targetPitch === "number") orbit.targetPitch = state.targetPitch;
  if (typeof state.targetDistance === "number") orbit.targetDistance = state.targetDistance;
  applyVec3(orbit.pivotPoint, state.pivotPoint);
  applyVec3(orbit.targetPivotPoint, state.targetPivotPoint);

  if (typeof handle.orbit.update === "function") {
    handle.orbit.update(0);
  }
}
