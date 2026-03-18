import { getCameraMethod } from "./api";

export function getZoom(): number | null {
  const getZoomMethod = getCameraMethod<() => number | null>("getZoom");
  if (!getZoomMethod) return null;

  try {
    return getZoomMethod();
  } catch (error) {
    console.error("[PlayCanvas] Failed to get zoom", error);
    return null;
  }
}
