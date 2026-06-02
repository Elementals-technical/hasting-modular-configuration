import { setConfigBatch } from "../setConfigBatch";
import {
  captureDividerPlayCanvasSnapshot,
  createDividerUiTraceId,
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  summarizeDividerSlotInfo,
  warnDividerUiDebug,
} from "./dividerUiDebug";
import type { OccupiedSlotInfo } from "./setOnOccupiedSlotClick";

type RemoveDividerPayload = Pick<
  OccupiedSlotInfo,
  "cabinetId" | "drawerType" | "zone" | "key" | "zoneIndex" | "stateId" | "dividerType"
> & {
  debugRequestId: string;
  start?: number;
};

export async function removeDividerFromSlot(slotInfo: OccupiedSlotInfo) {
  const startedAt = performance.now();
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.removeDividerFromSlot;
  const debugRequestId = slotInfo.debugRequestId ?? createDividerUiTraceId("ui-remove");
  const payload: RemoveDividerPayload = {
    cabinetId: slotInfo.cabinetId,
    drawerType: slotInfo.drawerType,
    zone: slotInfo.zone,
    key: slotInfo.key,
    zoneIndex: slotInfo.zoneIndex,
    stateId: slotInfo.stateId,
    dividerType: slotInfo.dividerType,
    debugRequestId,
    start: slotInfo.position?.start,
  };

  recordDividerUiDebug("API.removeDividerFromSlot", "Start", {
    debugRequestId,
    hasExplicitApi: Boolean(apiMethod),
    slotInfo: summarizeDividerSlotInfo(slotInfo),
    payload,
  });

  try {
    if (apiMethod) {
      const result = await apiMethod(payload);
      recordDividerUiDebug("API.removeDividerFromSlot", "Done via explicit API", {
        debugRequestId,
        durationMs: Math.round(performance.now() - startedAt),
        payload,
        result,
        playCanvasSnapshot: captureDividerPlayCanvasSnapshot(),
      });
      return result;
    }

    warnDividerUiDebug("API.removeDividerFromSlot", "Explicit API missing; falling back to setConfigBatch", {
      debugRequestId,
      payload,
    });

    const result = await setConfigBatch(
      payload as unknown as Parameters<typeof setConfigBatch>[0],
      { value: "empty" },
    );

    recordDividerUiDebug("API.removeDividerFromSlot", "Done via fallback", {
      debugRequestId,
      durationMs: Math.round(performance.now() - startedAt),
      payload,
      result,
      playCanvasSnapshot: captureDividerPlayCanvasSnapshot(),
    });

    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to removeDividerFromSlot", error);
    errorDividerUiDebug("API.removeDividerFromSlot", "Failed", {
      debugRequestId,
      durationMs: Math.round(performance.now() - startedAt),
      payload,
      error,
    });
    return null;
  }
}
