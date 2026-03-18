import { getCameraMethod } from "./api";
import type { CameraFramingConfig } from "./types";

export function getFramingConfig(): CameraFramingConfig | null {
  const getFramingConfigMethod = getCameraMethod<() => CameraFramingConfig | null>("getFramingConfig");
  if (!getFramingConfigMethod) return null;

  try {
    return getFramingConfigMethod();
  } catch (error) {
    console.error("[PlayCanvas] Failed to get framing config", error);
    return null;
  }
}
