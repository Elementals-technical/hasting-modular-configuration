import { getCameraMethod } from "./api";

export function zoomIn(step?: number) {
  const zoomInMethod = getCameraMethod<(step?: number) => number | null>("zoomIn");
  if (!zoomInMethod) return null;

  try {
    return zoomInMethod(step);
  } catch (error) {
    console.error("[PlayCanvas] Failed to zoom in", error);
    return null;
  }
}
