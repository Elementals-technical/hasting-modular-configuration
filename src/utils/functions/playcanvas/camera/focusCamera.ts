import { getCameraMethod } from "./api";

export function focusCamera(entity?: unknown) {
  const focusCameraMethod = getCameraMethod<(entity?: unknown) => void>("focusCamera");
  if (!focusCameraMethod) return;

  try {
    focusCameraMethod(entity);
  } catch (error) {
    console.error("[PlayCanvas] Failed to focus camera", error);
  }
}
