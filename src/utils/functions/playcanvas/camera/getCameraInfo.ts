import { getCameraMethod } from "./api";
import type { CameraInfo } from "./types";

export function getCameraInfo(): CameraInfo | null {
  const getCameraInfoMethod = getCameraMethod<() => CameraInfo | null>("getCameraInfo");
  if (!getCameraInfoMethod) return null;

  try {
    return getCameraInfoMethod();
  } catch (error) {
    console.error("[PlayCanvas] Failed to get camera info", error);
    return null;
  }
}
