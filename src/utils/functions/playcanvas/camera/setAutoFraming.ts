import { getCameraMethod } from "./api";

export function setAutoFraming(enabled: boolean) {
  const setAutoFramingMethod = getCameraMethod<(enabled: boolean) => void>("setAutoFraming");
  if (!setAutoFramingMethod) return;

  try {
    setAutoFramingMethod(enabled);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set auto framing", error);
  }
}
