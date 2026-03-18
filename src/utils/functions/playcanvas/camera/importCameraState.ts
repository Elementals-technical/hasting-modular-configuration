import { getCameraMethod } from "./api";
import type { CameraState } from "./types";

export function importCameraState(state: CameraState) {
  const importCameraStateMethod = getCameraMethod<(state: CameraState) => void>("importCameraState");
  if (!importCameraStateMethod) return;

  try {
    importCameraStateMethod(state);
  } catch (error) {
    console.error("[PlayCanvas] Failed to import camera state", error);
  }
}
