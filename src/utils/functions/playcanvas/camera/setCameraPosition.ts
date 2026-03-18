import { getCameraMethod } from "./api";
import type { CameraInfo } from "./types";

export function setCameraPosition(info: CameraInfo): boolean {
  const setCameraPositionMethod = getCameraMethod<(info: CameraInfo) => boolean>("setCameraPosition");
  if (!setCameraPositionMethod) return false;

  try {
    return setCameraPositionMethod(info);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set camera position", error);
    return false;
  }
}
