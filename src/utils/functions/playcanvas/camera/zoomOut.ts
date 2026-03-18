import { getCameraMethod } from "./api";

export function zoomOut(step?: number) {
  const zoomOutMethod = getCameraMethod<(step?: number) => number | null>("zoomOut");
  if (!zoomOutMethod) return null;

  try {
    return zoomOutMethod(step);
  } catch (error) {
    console.error("[PlayCanvas] Failed to zoom out", error);
    return null;
  }
}
