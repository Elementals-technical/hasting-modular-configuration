import {
  errorDividerUiDebug,
  getDividerConfiguratorWindow,
  recordDividerUiDebug,
  summarizeDividerSlotInfo,
  warnDividerUiDebug,
} from "./dividerUiDebug";

export type DividerSlotInfo = {
  cabinetId: string;
  drawerType: "Top" | "TopFull" | "Bot";
  zone: string;
  key: string;
  availableTypes: string[];
  zoneIndex?: number;
  placementType?: "A" | "B" | "C" | null;
  canPlace?: boolean;
  disabledReason?: "select-divider" | "does-not-fit" | "no-space" | null;
  /** Zone-local start offset in cm — REQUIRED by the runtime to accept a placement. */
  start?: number;
  /** Zone packing anchor of the candidate. */
  anchor?: "left" | "right";
  debugRequestId?: string;
  position?: {
    start: number;
    center: number;
    end: number;
  };
  slot?: unknown;
};

export function setOnAddSlotClick(callback: (slotInfo: DividerSlotInfo) => void | Promise<void>) {
  const canvasIframe = getDividerConfiguratorWindow();
  const apiMethod = canvasIframe?.ConfiguratorAPI?.dividers?.setOnAddSlotClick;

  recordDividerUiDebug("API.setOnAddSlotClick", "Register handler", {
    hasApi: Boolean(apiMethod),
    hasCallback: typeof callback === "function",
  });

  if (!apiMethod) {
    console.warn("[PlayCanvas] ConfiguratorAPI.dividers.setOnAddSlotClick not ready");
    warnDividerUiDebug("API.setOnAddSlotClick", "PlayCanvas API method is not ready");
    return null;
  }

  try {
    return apiMethod((slotInfo) => {
      recordDividerUiDebug("Callback.onAddSlotClick", "Fired", {
        slotInfo: summarizeDividerSlotInfo(slotInfo),
      });
      try {
        Promise.resolve(callback(slotInfo as DividerSlotInfo)).catch((error: unknown) => {
          errorDividerUiDebug("Callback.onAddSlotClick", "Async callback failed", {
            slotInfo: summarizeDividerSlotInfo(slotInfo),
            error,
          });
        });
      } catch (error) {
        errorDividerUiDebug("Callback.onAddSlotClick", "Callback failed", {
          slotInfo: summarizeDividerSlotInfo(slotInfo),
          error,
        });
      }
    });
  } catch (error) {
    console.error("[PlayCanvas] Failed to setOnAddSlotClick", error);
    errorDividerUiDebug("API.setOnAddSlotClick", "Failed to register handler", { error });
    return null;
  }
}
