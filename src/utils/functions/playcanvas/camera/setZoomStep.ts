import { getCameraMethod } from "./api";

export function setZoomStep(step: number) {
  const setZoomStepMethod = getCameraMethod<(step: number) => void>("setZoomStep");
  if (!setZoomStepMethod) return;

  try {
    setZoomStepMethod(step);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set zoom step", error);
  }
}
