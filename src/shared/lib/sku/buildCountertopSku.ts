import { cmToInches } from "./cmToInches";
import { countertopStyleSkuMap, countertopMaterialSkuMap, basinSkuMap } from "./countertopSkuMaps";

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
  /** e.g. '4"' or '6"' */
  faucetHolesSpacing: string | null;
  /** Material SKU for countertop body (e.g. "FX", "HPL", "POR") */
  countertopMaterialSku: string | null;
  /** Color code (e.g. "37GL", "FEMT") */
  countertopColorCode: string | null;
};

const FALLBACK = "X";
const CATEGORY = "CT";
const LOG_PREFIX = "[SKU/CT]";
const mapThicknessToSkuValue = (value: number): number => (Math.abs(value - 2.5) < 0.001 ? 2.4 : value);
const formatThicknessToken = (value: number): string => value.toFixed(1).replace(/^0(?=\.)/, "");

const inferMaterialSkuFromBasinType = (basinType: string | null): string | null => {
  const basin = basinType?.trim() ?? "";
  if (!basin) return null;

  if (basin.startsWith("Top_Tekorlux_")) return "SSTKR";
  if (basin.startsWith("Top_Tekormud_") || basin.startsWith("Top_Tekorund_")) return "SSTM";
  if (basin.startsWith("Top_Ocritech_")) return "SSOCR";
  if (basin.startsWith("Top_Mineralmarmo_")) return "SSMMO";
  if (basin.startsWith("Top_Porcelain_")) return "POR";
  if (basin.startsWith("Top_HPL/Fenix_") || basin === "Fenix_Strip_Gres") return "FX";
  if (basin.startsWith("Top_HPL")) return "HPL";

  return null;
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

/**
 * Returns an array of SKU lines for the countertop:
 *  [0] Top        — always present  CT-{SERIES}-{STYLE}-{W}W-{THICKNESS}H-{D}D-{MatSKU}-{Color}
 *  [1] Basin      — if style is integrated or vessel  CT-{SERIES}-{BASIN}
 *  [2] Faucet Qty — if faucet holes > 0  CT-{SERIES}-FAHO/{QTY}
 *  [3] Faucet Spc — if faucet holes > 0  CT-{SERIES}-FAHOS/{SPACING}
 *  [4] Hole Cut   — if style is vessel   CT-{SERIES}-HCUT
 *
 * SERIES is derived from material SKU: "UR" + materialSku (e.g. FX → URFX, HPL → URHPL)
 */
export function buildCountertopSku(input: CountertopSkuInput): string[] {
  console.log(LOG_PREFIX, "buildCountertopSku input", input);
  const styleValue = input.style?.trim() || "plain";
  const styleSku = resolve(countertopStyleSkuMap, styleValue, { caseInsensitiveKey: true });

  // Dimensions: converted from cm to inches (÷ 2.54, 1 decimal)
  const w = input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  const rawT = input.thickness?.trim();
  const parsedT = rawT ? parseFloat(rawT) : null;
  const thicknessForSku = parsedT != null && !isNaN(parsedT) ? mapThicknessToSkuValue(parsedT) : null;
  const t = thicknessForSku != null ? `${formatThicknessToken(thicknessForSku)}H` : FALLBACK;
  const d = input.depth != null ? `${cmToInches(input.depth)}D` : `${FALLBACK}D`;

  const isVessel = styleValue.toLowerCase() === "vessel";

  // Material block: -{MaterialSKU}-{ColorCode} — omitted for vessel style
  const resolvedMaterial = resolve(countertopMaterialSkuMap, input.countertopMaterialSku, {
    caseInsensitiveKey: true,
    allowMappedValue: true,
  });
  const inferredMaterial = inferMaterialSkuFromBasinType(input.basinType);
  // Basin type is the most reliable source of countertop material for integrated tops.
  // Prefer it over color-derived/material token when present.
  const mat =
    inferredMaterial ??
    (resolvedMaterial !== FALLBACK ? resolvedMaterial : null);
  const color = input.countertopColorCode?.trim() || null;
  const matBlock = !isVessel && mat ? `-${mat}${color ? `-${color}` : ""}` : "";

  // Series is dynamic: "UR" + materialSku (e.g. "URFX", "URHPL", "URPOR")
  const series = mat ? `UR${mat}` : "URFX";
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

    const spacing = input.faucetHolesSpacing?.replace(/"/g, "").trim() || null;
    if (spacing) {
      lines.push(`${CATEGORY}-${series}-FAHOS/${spacing}`);
    }
  }

  // Hole cutout — only for vessel
  if (isVessel) {
    lines.push(`${CATEGORY}-${series}-HCUT`);
  }

  console.log(LOG_PREFIX, "buildCountertopSku output", lines);
  return lines;
}
