import {
  captureDividerPlayCanvasSnapshot,
  createDividerUiTraceId,
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  summarizeDividerSlotInfo,
  warnDividerUiDebug,
} from "./dividerUiDebug";
import type { DividerSlotInfo } from "./setOnAddSlotClick";

export async function placeDividerToSlot(slotInfo: DividerSlotInfo, type: "A" | "B" | "C") {
  const startedAt = performance.now();
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.placeDividerToSlot;
  const debugRequestId = slotInfo.debugRequestId ?? createDividerUiTraceId("ui-place");
  const payload = {
    ...slotInfo,
    debugRequestId,
  };

  recordDividerUiDebug("API.placeDividerToSlot", "Start", {
    debugRequestId,
    hasApi: Boolean(apiMethod),
    slotInfo: summarizeDividerSlotInfo(payload),
    type,
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.placeDividerToSlot not ready");
    warnDividerUiDebug("API.placeDividerToSlot", "PlayCanvas API method is not ready", {
      debugRequestId,
      slotInfo: summarizeDividerSlotInfo(payload),
      type,
    });
    return null;
  }

  try {
    const result = await apiMethod(payload, type);
    recordDividerUiDebug("API.placeDividerToSlot", "Done", {
      debugRequestId,
      durationMs: Math.round(performance.now() - startedAt),
      slotInfo: summarizeDividerSlotInfo(payload),
      type,
      result,
      playCanvasSnapshot: captureDividerPlayCanvasSnapshot(),
    });
    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to placeDividerToSlot", error);
    errorDividerUiDebug("API.placeDividerToSlot", "Failed", {
      debugRequestId,
      durationMs: Math.round(performance.now() - startedAt),
      slotInfo: summarizeDividerSlotInfo(payload),
      type,
      error,
    });
    return null;
  }
}
