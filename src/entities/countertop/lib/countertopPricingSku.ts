import { countertopMaterialSkuMap, countertopStyleSkuMap } from "@/shared/lib/sku";

import { COUNTERTOP_THICKNESS_OPTIONS } from "./thicknessOptions";

const COUNTERTOP_CATEGORY = "CT";
const COUNTERTOP_PRODUCT_PREFIX = "UR";

const SIZE_TOKEN_PATTERN = /^(\d+(?:\.\d+)?|\.\d+)([WHD])$/i;

const stripSizeUnit = (token: string, unit: "W" | "H" | "D") => {
  const match = token.trim().match(SIZE_TOKEN_PATTERN);
  if (!match || match[2].toUpperCase() !== unit) return null;
  return match[1];
};

const normalizeCountertopThicknessToken = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;

  let normalized = parsed;
  if (Math.abs(parsed - 5.125) < 0.001) normalized = 5.1;
  if (Math.abs(parsed - 2.5) < 0.001 || Math.abs(parsed - 2.375) < 0.001) normalized = 2.4;

  return normalized.toFixed(1).replace(/^0(?=\.)/, "");
};

const COUNTERTOP_MATERIAL_SKUS = new Set(Object.values(countertopMaterialSkuMap));
const COUNTERTOP_TOP_STYLE_TOKENS = new Set(Object.values(countertopStyleSkuMap));
const ALLOWED_COUNTERTOP_THICKNESS_TOKENS = new Set(
  COUNTERTOP_THICKNESS_OPTIONS.flatMap((option) => [option.value, option.title])
    .map(normalizeCountertopThicknessToken)
    .filter((value): value is string => value != null),
);

const hasNumericSizeToken = (token: string, unit: "W" | "H" | "D") => {
  const value = stripSizeUnit(token, unit);
  if (value == null) return false;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed);
};

export const isCountertopTopDynamicCandidate = (sku: string, widthCm: number | null | undefined) => {
  if (widthCm == null || !Number.isFinite(widthCm) || widthCm <= 0) return false;

  const [category, product, style, widthToken, heightToken, depthToken, tailMaterialToken, colorToken] = sku.trim().split("-");
  if (category !== COUNTERTOP_CATEGORY) return false;
  if (!product?.startsWith(COUNTERTOP_PRODUCT_PREFIX)) return false;

  const materialSku = product.slice(COUNTERTOP_PRODUCT_PREFIX.length);
  if (!COUNTERTOP_MATERIAL_SKUS.has(materialSku)) return false;
  if (!COUNTERTOP_TOP_STYLE_TOKENS.has(style)) return false;
  if (!hasNumericSizeToken(widthToken ?? "", "W")) return false;
  if (!hasNumericSizeToken(depthToken ?? "", "D")) return false;
  if (!tailMaterialToken || !colorToken) return false;

  const height = stripSizeUnit(heightToken ?? "", "H");
  if (height == null) return false;

  const normalizedThickness = normalizeCountertopThicknessToken(height);
  return normalizedThickness != null && ALLOWED_COUNTERTOP_THICKNESS_TOKENS.has(normalizedThickness);
};
