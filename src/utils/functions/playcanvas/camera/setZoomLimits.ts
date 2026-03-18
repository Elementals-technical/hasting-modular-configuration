import { getCameraMethod } from "./api";

export function setZoomLimits(minDistance: number, maxDistance: number) {
  const setZoomLimitsMethod = getCameraMethod<(minDistance: number, maxDistance: number) => void>("setZoomLimits");
  if (!setZoomLimitsMethod) return;

  try {
    setZoomLimitsMethod(minDistance, maxDistance);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set zoom limits", error);
  }
}
