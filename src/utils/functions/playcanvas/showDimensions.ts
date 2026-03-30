type DimensionAxis = "x" | "y" | "z";
type DimensionUnit = "m" | "cm" | "mm" | "in" | "ft";
type LabelPosition = "above" | "below" | "center";

type Vec3Input = {
  x: number;
  y: number;
  z: number;
};

type DimensionValue = {
  label?: string;
  offset?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  start?: Vec3Input | [number, number, number];
  end?: Vec3Input | [number, number, number];
  fontSize?: number;
  fontFamily?: string;
  labelPosition?: LabelPosition;
  labelGap?: number | "auto";
  units?: DimensionUnit;
  decimals?: number;
  labelTemplate?: string;
};

type DimensionsBoxPayload = {
  nodes: string[];
  width?: string | DimensionValue;
  height?: string | DimensionValue;
  depth?: string | DimensionValue;
};

type DimensionsLinePayload = {
  node?: string;
  axis?: DimensionAxis;
  label?: string;
  offset?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  start?: Vec3Input | [number, number, number];
  end?: Vec3Input | [number, number, number];
  fontSize?: number;
  fontFamily?: string;
  labelPosition?: LabelPosition;
  labelGap?: number | "auto";
  units?: DimensionUnit;
  decimals?: number;
  labelTemplate?: string;
};

type LabelSettings = {
  offset?: number;
  labelGap?: number | "auto";
  labelPosition?: LabelPosition;
  units?: DimensionUnit;
  decimals?: number;
  labelTemplate?: string;
  fontSize?: number;
  fontFamily?: string;
};

export type DimensionsPayload = {
  box?: DimensionsBoxPayload;
  lines?: DimensionsLinePayload[];
  labelSettings?: LabelSettings;
};

type ConfiguratorApiWithDimensions = {
  showDimensions?: (data: DimensionsPayload) => void;
  hideDimensions?: () => void;
  toggleDimensions?: () => void;
};

const getConfiguratorApi = (): ConfiguratorApiWithDimensions | null => {
  // @ts-ignore
  const containerRef = window.containerRef;
  const canvasIframe = containerRef?.current?.contentWindow as any;
  const api = canvasIframe?.ConfiguratorAPI as ConfiguratorApiWithDimensions | undefined;
  return api ?? null;
};

export function showDimensions(data: DimensionsPayload) {
  const api = getConfiguratorApi();
  if (!api?.showDimensions) {
    console.warn("[PlayCanvas] ConfiguratorAPI.showDimensions not ready");
    return false;
  }

  try {
    api.showDimensions(data);
    return true;
  } catch (error) {
    console.error("[PlayCanvas] Failed to call showDimensions", error);
    return false;
  }
}

export function hideDimensions() {
  const api = getConfiguratorApi();
  if (!api?.hideDimensions) {
    console.warn("[PlayCanvas] ConfiguratorAPI.hideDimensions not ready");
    return false;
  }

  try {
    api.hideDimensions();
    return true;
  } catch (error) {
    console.error("[PlayCanvas] Failed to call hideDimensions", error);
    return false;
  }
}

export function toggleDimensions() {
  const api = getConfiguratorApi();
  if (!api?.toggleDimensions) {
    console.warn("[PlayCanvas] ConfiguratorAPI.toggleDimensions not ready");
    return false;
  }

  try {
    api.toggleDimensions();
    return true;
  } catch (error) {
    console.error("[PlayCanvas] Failed to call toggleDimensions", error);
    return false;
  }
}
