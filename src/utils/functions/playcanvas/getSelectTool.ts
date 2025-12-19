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

export type SelectTool = {
  setSelected: (entities: PlayCanvasEntity | PlayCanvasEntity[], options?: SelectionOptions) => void;
  setSelectedByName: (names: string | string[], options?: SelectionOptions) => void;
  deselectAll: () => void;
  getSelected: () => PlayCanvasEntity[];
  setSelectionMode: (mode: SelectionMode) => void;
  getSelectionMode: () => SelectionMode;
  on: (event: "select", handler: (selectedEntity: SelectionEventPayload) => void) => void;
};

export function getSelectTool(): SelectTool | null {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const apiGetSelectTool = canvasIframe?.ConfiguratorAPI?.getSelectTool;

  if (!apiGetSelectTool) {
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
