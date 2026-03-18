import { getCameraMethod } from "./api";

export function getZoomStep(): number | null {
  const getZoomStepMethod = getCameraMethod<() => number>("getZoomStep");
  if (!getZoomStepMethod) return null;

  try {
    return getZoomStepMethod();
  } catch (error) {
    console.error("[PlayCanvas] Failed to get zoom step", error);
    return null;
  }
}
