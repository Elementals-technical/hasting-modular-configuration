import { getCameraMethod } from "./api";
import type { CameraFramingConfig } from "./types";

export function setFramingConfig(config: CameraFramingConfig) {
  const setFramingConfigMethod = getCameraMethod<(config: CameraFramingConfig) => void>("setFramingConfig");
  if (!setFramingConfigMethod) return;

  try {
    setFramingConfigMethod(config);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set framing config", error);
  }
}
