export type SelectionMode = "single" | "multi";
export type SelectionUpdateMode = "replace" | "add" | "remove" | "toggle";

export type SelectionOptions = {
  mode?: SelectionUpdateMode;
};

export type PlayCanvasEntity = {
  name?: string;
  [key: string]: unknown;
};

export type SelectionEventPayload = PlayCanvasEntity | PlayCanvasEntity[] | null;

export type SelectionActionConfig = Record<string, unknown>;

export type SelectionAction = {
  id: string;
  label?: string;
  method?: string;
  productId?: string | null;
  configKey?: string;
  config?: SelectionActionConfig;
  [key: string]: unknown;
};

export type SelectionInfo = {
  entityName?: string;
  selectionType?: string;
  displayName?: string;
  productId?: string | null;
  productType?: string | null;
  sinkType?: string | null;
  isVessel?: boolean;
  colorConfigKey?: string | null;
  actions?: SelectionAction[];
  [key: string]: unknown;
};

export type SelectTool = {
  setSelected: (entities: PlayCanvasEntity | PlayCanvasEntity[], options?: SelectionOptions) => void;
  setSelectedByName: (names: string | string[], options?: SelectionOptions) => void;
  deselectAll: () => void;
  getSelected: () => PlayCanvasEntity[];
  getSelectionInfo: () => SelectionInfo[];
  setSelectionMode: (mode: SelectionMode) => void;
  getSelectionMode: () => SelectionMode;
  on: (event: "select", handler: (selectedEntity: SelectionEventPayload, selectionInfo?: SelectionInfo[]) => void) => void;
};

type ConfiguratorApiWithSelectTool = {
  getSelectTool?: () => unknown;
};

type WindowWithPlayCanvasContainer = Window & {
  containerRef?: {
    current?: {
      contentWindow?: {
        ConfiguratorAPI?: ConfiguratorApiWithSelectTool;
      } | null;
    } | null;
  };
};

export function getSelectTool(): SelectTool | null {
  const containerRef = (window as WindowWithPlayCanvasContainer).containerRef;
  const canvasIframe = containerRef?.current?.contentWindow;
  const apiGetSelectTool = canvasIframe?.ConfiguratorAPI?.getSelectTool;

  if (typeof apiGetSelectTool !== "function") {
    console.warn("[PlayCanvas] ConfiguratorAPI.getSelectTool not ready");
    return null;
  }

  try {
    return apiGetSelectTool() as SelectTool;
  } catch (error) {
    console.error("[PlayCanvas] Failed to get select tool", error);
    return null;
  }
}
