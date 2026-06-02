import {
  createDividerUiTraceId,
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "./dividerUiDebug";

export type DividerType = "A" | "B" | "C";
export type DrawerType = "Top" | "TopFull" | "Bot";
export type ShowIconDividerSlotsOptions =
  | boolean
  | {
      show?: boolean;
      selectedDividerType?: DividerType | null;
      debugRequestId?: string;
    };

export function showIconDividerSlots(
  cabinetId: string,
  drawerType: DrawerType,
  options: ShowIconDividerSlotsOptions = true,
) {
  const startedAt = performance.now();
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.showIconDividerSlots;
  const normalizedOptions =
    typeof options === "object" && options !== null
      ? {
          ...options,
          debugRequestId: options.debugRequestId ?? createDividerUiTraceId("ui-overlay"),
        }
      : options;

  recordDividerUiDebug("API.showIconDividerSlots", "Start", {
    hasApi: Boolean(apiMethod),
    cabinetId,
    drawerType,
    options: normalizedOptions,
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.showIconDividerSlots not ready");
    warnDividerUiDebug("API.showIconDividerSlots", "PlayCanvas API method is not ready", {
      cabinetId,
      drawerType,
      options: normalizedOptions,
    });
    return null;
  }

  try {
    const result = apiMethod(cabinetId, drawerType, normalizedOptions);
    recordDividerUiDebug("API.showIconDividerSlots", "Done", {
      durationMs: Math.round(performance.now() - startedAt),
      cabinetId,
      drawerType,
      options: normalizedOptions,
      result,
    });
    return result;
  } catch (error) {
    console.error("[PlayCanvas] Failed to showIconDividerSlots", error);
    errorDividerUiDebug("API.showIconDividerSlots", "Failed", {
      durationMs: Math.round(performance.now() - startedAt),
      cabinetId,
      drawerType,
      options: normalizedOptions,
      error,
    });
    return null;
  }
}
