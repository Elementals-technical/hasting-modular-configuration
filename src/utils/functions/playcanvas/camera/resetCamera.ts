import { getCameraMethod } from "./api";

export function resetCamera(yaw: number, pitch: number, distance: number) {
  const resetCameraMethod = getCameraMethod<(yaw: number, pitch: number, distance: number) => void>("resetCamera");
  if (!resetCameraMethod) return;

  try {
    resetCameraMethod(yaw, pitch, distance);
  } catch (error) {
    console.error("[PlayCanvas] Failed to reset camera", error);
  }
}
