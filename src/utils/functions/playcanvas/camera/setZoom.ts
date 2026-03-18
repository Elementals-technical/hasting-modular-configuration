import { getCameraMethod } from "./api";

export function setZoom(distance: number): number | null {
  const setZoomMethod = getCameraMethod<(distance: number) => number | null>("setZoom");
  if (!setZoomMethod) return null;

  try {
    return setZoomMethod(distance);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set zoom", error);
    return null;
  }
}
