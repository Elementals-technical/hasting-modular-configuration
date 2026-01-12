export type DimensionLabelMap = Record<string, string>;

export type DimensionConfig = {
  Height?: DimensionLabelMap;
  Width?: DimensionLabelMap;
  Depth?: DimensionLabelMap;
  [key: string]: DimensionLabelMap | undefined;
};

export type DimensionData = {
  productId: string;
  Height?: DimensionLabelMap;
  Width?: DimensionLabelMap;
  Depth?: DimensionLabelMap;
  [key: string]: DimensionLabelMap | string | undefined;
};

export type DimensionTool = {
  setEnabled: (enabled: boolean) => void;
  setDimensionData: (data: DimensionData) => void;
  getDimensionData?: (productId: string) => DimensionConfig | null;
};

export function getDimensionTool(): DimensionTool | null {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const apiGetDimensionTool = canvasIframe?.ConfiguratorAPI?.getDimensionTool;

  if (!apiGetDimensionTool) {
    console.warn("[PlayCanvas] ConfiguratorAPI.getDimensionTool not ready");
    return null;
  }

  try {
    return apiGetDimensionTool() as DimensionTool;
  } catch (error) {
    console.error("[PlayCanvas] Failed to get dimension tool", error);
    return null;
  }
}
