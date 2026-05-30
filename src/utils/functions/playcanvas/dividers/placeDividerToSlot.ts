import {
  captureDividerPlayCanvasSnapshot,
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "./dividerUiDebug";
import type { DividerSlotInfo } from "./setOnAddSlotClick";

export async function placeDividerToSlot(slotInfo: DividerSlotInfo, type: "A" | "B" | "C") {
  const startedAt = performance.now();
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.placeDividerToSlot;

  recordDividerUiDebug("API.placeDividerToSlot", "Start", {
    hasApi: Boolean(apiMethod),
    slotInfo,
    type,
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.placeDividerToSlot not ready");
    warnDividerUiDebug("API.placeDividerToSlot", "PlayCanvas API method is not ready", {
      slotInfo,
      type,
    });
    return null;
  }

  try {
    const result = await apiMethod(slotInfo, type);
    recordDividerUiDebug("API.placeDividerToSlot", "Done", {
      durationMs: Math.round(performance.now() - startedAt),
      slotInfo,
      type,
      result,
      playCanvasSnapshot: captureDividerPlayCanvasSnapshot(),
    });
    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to placeDividerToSlot", error);
    errorDividerUiDebug("API.placeDividerToSlot", "Failed", {
      durationMs: Math.round(performance.now() - startedAt),
      slotInfo,
      type,
      error,
    });
    return null;
  }
}
