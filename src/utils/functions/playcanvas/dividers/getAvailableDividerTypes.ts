import {
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "./dividerUiDebug";
import type { DividerSlotInfo } from "./setOnAddSlotClick";

export type DividerSlotKey = Pick<DividerSlotInfo, "cabinetId" | "drawerType" | "zone" | "key">;

export function getAvailableDividerTypes(slot: DividerSlotKey) {
  const startedAt = performance.now();
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.getAvailableDividerTypes;

  recordDividerUiDebug("API.getAvailableDividerTypes", "Start", {
    hasApi: Boolean(apiMethod),
    slot,
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.getAvailableDividerTypes not ready");
    warnDividerUiDebug("API.getAvailableDividerTypes", "PlayCanvas API method is not ready", {
      slot,
    });
    return null;
  }

  try {
    const result = apiMethod({
      cabinetId: slot.cabinetId,
      drawerType: slot.drawerType,
      zone: slot.zone,
      slotKey: slot.key,
    });
    recordDividerUiDebug("API.getAvailableDividerTypes", "Done", {
      durationMs: Math.round(performance.now() - startedAt),
      slot,
      result,
    });
    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to getAvailableDividerTypes", error);
    errorDividerUiDebug("API.getAvailableDividerTypes", "Failed", {
      durationMs: Math.round(performance.now() - startedAt),
      slot,
      error,
    });
    return null;
  }
}
