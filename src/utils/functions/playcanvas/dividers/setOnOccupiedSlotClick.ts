import {
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  warnDividerUiDebug,
} from "./dividerUiDebug";

export type OccupiedSlotInfo = {
  cabinetId: string;
  drawerType: "Top" | "TopFull" | "Bot";
  zone: string;
  key: string;
  isOccupied: boolean;
  stateId: string;
  dividerType: string;
  zoneIndex: number;
  position?: {
    start: number;
    center: number;
    end: number;
  };
  slot?: unknown;
};

export function setOnOccupiedSlotClick(callback: (slotInfo: OccupiedSlotInfo) => void | Promise<void>) {
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.setOnOccupiedSlotClick;

  recordDividerUiDebug("API.setOnOccupiedSlotClick", "Register handler", {
    hasApi: Boolean(apiMethod),
    hasCallback: typeof callback === "function",
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.setOnOccupiedSlotClick not ready");
    warnDividerUiDebug("API.setOnOccupiedSlotClick", "PlayCanvas API method is not ready");
    return null;
  }

  try {
    return apiMethod((slotInfo) => {
      recordDividerUiDebug("Callback.onOccupiedSlotClick", "Fired", { slotInfo });
      try {
        Promise.resolve(callback(slotInfo as OccupiedSlotInfo)).catch((error: unknown) => {
          errorDividerUiDebug("Callback.onOccupiedSlotClick", "Async callback failed", { slotInfo, error });
        });
      } catch (error) {
        errorDividerUiDebug("Callback.onOccupiedSlotClick", "Callback failed", { slotInfo, error });
      }
    });
  } catch (error) {
    console.error("[PlayCanvas] Failed to setOnOccupiedSlotClick", error);
    errorDividerUiDebug("API.setOnOccupiedSlotClick", "Failed to register handler", { error });
    return null;
  }
}
