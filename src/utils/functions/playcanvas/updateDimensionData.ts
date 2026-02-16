import { formatCmWithInches } from "@/utils/units";

import { getDimensionTool, type DimensionConfig, type DimensionData } from "./getDimensionTool";

type DimensionConfigInput = {
  Height?: number;
  Width?: number;
  Depth?: number;
  [key: string]: unknown;
};

const buildLabelMap = (value?: number) =>
  typeof value === "number" ? { [String(value)]: formatCmWithInches(value) } : undefined;

const areLabelMapsEqual = (a?: Record<string, string>, b?: Record<string, string>) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

const areDimensionConfigsEqual = (a?: DimensionConfig | null, b?: DimensionConfig | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    areLabelMapsEqual(a.Height, b.Height) &&
    areLabelMapsEqual(a.Width, b.Width) &&
    areLabelMapsEqual(a.Depth, b.Depth)
  );
};

export const updateDimensionDataForProduct = (productId: string, config: DimensionConfigInput) => {
  if (!productId) return;

  const heightMap = buildLabelMap(config.Height);
  const widthMap = buildLabelMap(config.Width);
  const depthMap = buildLabelMap(config.Depth);

  if (!heightMap && !widthMap && !depthMap) return;

  const nextConfig: DimensionConfig = {
    ...(heightMap ? { Height: heightMap } : {}),
    ...(widthMap ? { Width: widthMap } : {}),
    ...(depthMap ? { Depth: depthMap } : {}),
  };
  const nextData: DimensionData = { productId, ...nextConfig };

  const dimensionTool = getDimensionTool();
  if (!dimensionTool) return;

  const existing = dimensionTool.getDimensionData?.(productId);
  if (areDimensionConfigsEqual(existing, nextConfig)) return;

  dimensionTool.setDimensionData(nextData);
};
