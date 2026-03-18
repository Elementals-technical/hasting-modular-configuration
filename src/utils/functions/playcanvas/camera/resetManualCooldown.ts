import { getCameraMethod } from "./api";

export function resetManualCooldown() {
  const resetManualCooldownMethod = getCameraMethod<() => void>("resetManualCooldown");
  if (!resetManualCooldownMethod) return;

  try {
    resetManualCooldownMethod();
  } catch (error) {
    console.error("[PlayCanvas] Failed to reset manual cooldown", error);
  }
}
