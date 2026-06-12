import { cmToInches } from "./cmToInches";
import {
  countertopStyleSkuMap,
  countertopMaterialSkuMap,
  basinSkuMap,
  resolveCountertopMaterialSkuFromBasinType,
  resolveCountertopMaterialSkuFromColorCode,
} from "./countertopSkuMaps";

export type CountertopSkuInput = {
  /** "plain" | "integrated" | "vessel" | "undermount" */
  style: string | null;
  width: number | null;
  depth: number | null;
  /** Thickness as stored in Redux, e.g. "0.5", "2.375" */
  thickness: string | null;
  /** PlayCanvas sinkType, e.g. "Top_HPLPrisma" */
  basinType: string | null;
  /** "0"-"3" */
  faucetHolesAmount: string | null;
  /** Material SKU for countertop body (e.g. "FX", "HPL", "POR") */
  countertopMaterialSku: string | null;
  /** Color code (e.g. "37GL", "FEMT") */
  countertopColorCode: string | null;
};

const FALLBACK = "X";
const CATEGORY = "CT";
const LOG_PREFIX = "[SKU/CT]";
const INVALID_COUNTERTOP_STYLE_ERROR = "Cannot build countertop SKU with unknown countertop style";
const MISSING_COUNTERTOP_MATERIAL_ERROR = "Cannot build countertop SKU without countertop material or color code";
const MISSING_COUNTERTOP_COLOR_ERROR = "Cannot build countertop SKU without countertop color code";
const MISSING_COUNTERTOP_DIMENSIONS_ERROR = "Cannot build countertop SKU without width, depth, and thickness";
const mapThicknessToSkuValue = (value: number): number => (Math.abs(value - 2.5) < 0.001 ? 2.4 : value);
const formatThicknessToken = (value: number): string => {
  const fixed = value.toFixed(1);
  const normalized = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
  return normalized.replace(/^0(?=\.)/, "");
};

const formatTopMaterialBlock = (materialSku: string | null, colorCode: string | null): string => {
  if (!materialSku) return "";
  return `-${materialSku}${colorCode ? `-${colorCode}` : ""}`;
};

const isPositiveFiniteNumber = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const parseThicknessValue = (value: string | null): number | null => {
  const raw = value?.trim();
  if (!raw) return null;

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolve = (
  map: Record<string, string>,
  value: string | null,
  options: { caseInsensitiveKey?: boolean; allowMappedValue?: boolean } = {},
): string => {
  if (!value) return FALLBACK;

  const { caseInsensitiveKey = false, allowMappedValue = false } = options;
  const normalizedValue = value.trim();
  if (!normalizedValue) return FALLBACK;

  if (map[normalizedValue]) return map[normalizedValue];

  if (allowMappedValue) {
    const mappedValue = Object.values(map).find((code) => code.toLowerCase() === normalizedValue.toLowerCase());
    if (mappedValue) return mappedValue;
  }

  if (caseInsensitiveKey) {
    const matchedKey = Object.keys(map).find((key) => key.toLowerCase() === normalizedValue.toLowerCase());
    if (matchedKey) return map[matchedKey];
  }

  return FALLBACK;
};

const hasKnownCountertopStyle = (value: string) => {
  const normalizedValue = value.toLowerCase();
  return (
    Object.keys(countertopStyleSkuMap).some((key) => key.toLowerCase() === normalizedValue) ||
    Object.values(countertopStyleSkuMap).some((mappedValue) => mappedValue.toLowerCase() === normalizedValue)
  );
};

const resolveCountertopSkuMaterial = (input: CountertopSkuInput): string | null => {
  const resolvedMaterial = resolve(countertopMaterialSkuMap, input.countertopMaterialSku, {
    caseInsensitiveKey: true,
    allowMappedValue: true,
  });
  const inferredMaterial = resolveCountertopMaterialSkuFromBasinType(input.basinType);
  const colorMaterial = resolveCountertopMaterialSkuFromColorCode(input.countertopColorCode);

  return colorMaterial ?? inferredMaterial ?? (resolvedMaterial !== FALLBACK ? resolvedMaterial : null);
};

export const canBuildCountertopSku = (input: CountertopSkuInput): boolean => {
  const styleValue = input.style?.trim() || "plain";
  const color = input.countertopColorCode?.trim() || null;
  const parsedThickness = parseThicknessValue(input.thickness);

  return (
    hasKnownCountertopStyle(styleValue) &&
    resolveCountertopSkuMaterial(input) != null &&
    color != null &&
    isPositiveFiniteNumber(input.width) &&
    isPositiveFiniteNumber(input.depth) &&
    parsedThickness != null
  );
};

/**
 * Returns an array of SKU lines for the countertop:
 *  [0] Top        — always present  CT-{SERIES}-{STYLE}-{W}W-{THICKNESS}H-{D}D-{MatSKU}-{Color}
 *  [1] Basin      — if style is integrated or vessel  CT-{SERIES}-{BASIN}
 *  [2] Faucet Qty — if faucet holes > 0  CT-{SERIES}-FAHO/{QTY}
 *  [3] Hole Cut   — if style is vessel   CT-{SERIES}-HCUT
 *
 * SERIES is derived from material SKU: "UR" + materialSku (e.g. FX → URFX, HPL → URHPL)
 */
export function buildCountertopSku(input: CountertopSkuInput): string[] {
  console.log(LOG_PREFIX, "buildCountertopSku input", input);
  const styleValue = input.style?.trim() || "plain";
  if (!hasKnownCountertopStyle(styleValue)) {
    throw new Error(INVALID_COUNTERTOP_STYLE_ERROR);
  }

  const styleSku = resolve(countertopStyleSkuMap, styleValue, { caseInsensitiveKey: true, allowMappedValue: true });

  const isVessel = styleValue.toLowerCase() === "vessel";

  // Top material block is shared across styles: -{MaterialSKU}-{ColorCode}
  const resolvedMaterial = resolve(countertopMaterialSkuMap, input.countertopMaterialSku, {
    caseInsensitiveKey: true,
    allowMappedValue: true,
  });
  const inferredMaterial = resolveCountertopMaterialSkuFromBasinType(input.basinType);
  const colorMaterial = resolveCountertopMaterialSkuFromColorCode(input.countertopColorCode);
  // Syntesi finish codes are the strongest signal because API/scene state can still
  // carry the generic Tekorlux material SKU while the selected color is TAN/TAP.
  const mat =
    colorMaterial ??
    inferredMaterial ??
    (resolvedMaterial !== FALLBACK ? resolvedMaterial : null);
  const color = input.countertopColorCode?.trim() || null;
  if (!mat && !color) {
    throw new Error(MISSING_COUNTERTOP_MATERIAL_ERROR);
  }
  if (!color) {
    throw new Error(MISSING_COUNTERTOP_COLOR_ERROR);
  }
  if (!mat) {
    throw new Error(MISSING_COUNTERTOP_MATERIAL_ERROR);
  }

  const vesselMaterial = isVessel ? mat ?? "FX" : mat;

  // Dimensions: converted from cm to inches (÷ 2.54, 1 decimal)
  const parsedT = parseThicknessValue(input.thickness);
  const thicknessForSku = parsedT != null ? mapThicknessToSkuValue(parsedT) : null;
  if (!isPositiveFiniteNumber(input.width) || !isPositiveFiniteNumber(input.depth) || thicknessForSku == null) {
    throw new Error(MISSING_COUNTERTOP_DIMENSIONS_ERROR);
  }

  const w = `${cmToInches(input.width)}W`;
  const d = `${cmToInches(input.depth)}D`;
  const t = `${formatThicknessToken(thicknessForSku)}H`;
  const matBlock = formatTopMaterialBlock(vesselMaterial, color);

  // Series is dynamic: "UR" + materialSku (e.g. "URFX", "URHPL", "URPOR")
  const series = vesselMaterial ? `UR${vesselMaterial}` : "URFX";
  console.log(LOG_PREFIX, "material resolution", {
    basinType: input.basinType,
    countertopMaterialSkuInput: input.countertopMaterialSku,
    resolvedMaterial,
    inferredMaterial,
    selectedMaterial: mat,
    series,
    thicknessRaw: input.thickness,
    colorCode: color,
    styleValue,
    styleSku,
  });

  // Top line — always present
  const top = `${CATEGORY}-${series}-${styleSku}-${w}-${t}-${d}${matBlock}`;
  const lines: string[] = [top];

  // Basin — present whenever a basin style is selected
  if (input.basinType) {
    const basinSku = resolve(basinSkuMap, input.basinType, { caseInsensitiveKey: true, allowMappedValue: true });
    if (basinSku !== FALLBACK) {
      const basinMat = mat ?? FALLBACK;
      const basinColor = color ? `-${color}` : "";
      lines.push(`${CATEGORY}-${series}-${basinSku}-${t}-${basinMat}${basinColor}`);
    }
  }

  // Faucet holes
  const holesQty = input.faucetHolesAmount?.trim() || "0";
  if (holesQty !== "0" && holesQty !== "") {
    lines.push(`${CATEGORY}-${series}-FAHO/${holesQty}`);
  }

  // Hole cutout — only for vessel
  if (isVessel) {
    lines.push(`${CATEGORY}-${series}-HCUT`);
  }

  console.log(LOG_PREFIX, "buildCountertopSku output", lines);
  return lines;
}

export const buildCountertopSkuIfComplete = (input: CountertopSkuInput): string[] =>
  canBuildCountertopSku(input) ? buildCountertopSku(input) : [];
