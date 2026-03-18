import { getCameraMethod } from "./api";

export function setFramingDebug(enabled: boolean) {
  const setFramingDebugMethod = getCameraMethod<(enabled: boolean) => void>("setFramingDebug");
  if (!setFramingDebugMethod) return;

  try {
    setFramingDebugMethod(enabled);
  } catch (error) {
    console.error("[PlayCanvas] Failed to set framing debug mode", error);
  }
}
