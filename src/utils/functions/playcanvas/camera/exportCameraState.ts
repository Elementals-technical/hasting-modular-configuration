import { getCameraMethod } from "./api";
import type { CameraState } from "./types";

export function exportCameraState(): CameraState | null {
  const exportCameraStateMethod = getCameraMethod<() => CameraState | null>("exportCameraState");
  if (!exportCameraStateMethod) return null;

  try {
    return exportCameraStateMethod();
  } catch (error) {
    console.error("[PlayCanvas] Failed to export camera state", error);
    return null;
  }
}
