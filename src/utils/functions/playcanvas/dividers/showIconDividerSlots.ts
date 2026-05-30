import {
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "./dividerUiDebug";

export function showIconDividerSlots(cabinetId: string, drawerType: "Top" | "TopFull" | "Bot") {
  const startedAt = performance.now();
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.showIconDividerSlots;

  recordDividerUiDebug("API.showIconDividerSlots", "Start", {
    hasApi: Boolean(apiMethod),
    cabinetId,
    drawerType,
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.showIconDividerSlots not ready");
    warnDividerUiDebug("API.showIconDividerSlots", "PlayCanvas API method is not ready", {
      cabinetId,
      drawerType,
    });
    return null;
  }

  try {
    const result = apiMethod(cabinetId, drawerType);
    recordDividerUiDebug("API.showIconDividerSlots", "Done", {
      durationMs: Math.round(performance.now() - startedAt),
      cabinetId,
      drawerType,
      result,
    });
    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to showIconDividerSlots", error);
    errorDividerUiDebug("API.showIconDividerSlots", "Failed", {
      durationMs: Math.round(performance.now() - startedAt),
      cabinetId,
      drawerType,
      error,
    });
    return null;
  }
}
