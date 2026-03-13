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
 *  [0] Top        — always present  CT-{SERIES}-{STYLE}-{W}W-{THICKNESS}H-{D}D-CT-{MatSKU}-{Color}
 *  [1] Basin      — if style is integrated or vessel  CT-{SERIES}-{BASIN}
 *  [2] Faucet Qty — if faucet holes > 0  CT-{SERIES}-FAHO/{QTY}
 *  [3] Faucet Spc — if faucet holes > 0  CT-{SERIES}-FAHOS/{SPACING}
 *  [4] Hole Cut   — if style is vessel   CT-{SERIES}-HCUT
 *
 * SERIES is derived from material SKU: "UR" + materialSku (e.g. FX → URFX, HPL → URHPL)
 */
export function buildCountertopSku(input: CountertopSkuInput): string[] {
  const styleValue = input.style?.trim() || "plain";
  const styleSku = resolve(countertopStyleSkuMap, styleValue, { caseInsensitiveKey: true });

  // Dimensions: converted from cm to inches (÷ 2.54, 1 decimal)
  const w = input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  const rawT = input.thickness?.trim();
  const parsedT = rawT ? parseFloat(rawT) : null;
  const t = parsedT != null && !isNaN(parsedT) ? `${parsedT.toFixed(1)}H` : FALLBACK;
  const d = input.depth != null ? `${cmToInches(input.depth)}D` : `${FALLBACK}D`;

  const isVessel = styleValue.toLowerCase() === "vessel";

  // Material block: -CT-{MaterialSKU}-{ColorCode} — omitted for vessel style
  const resolvedMaterial = resolve(countertopMaterialSkuMap, input.countertopMaterialSku, {
    caseInsensitiveKey: true,
    allowMappedValue: true,
  });
  const mat = resolvedMaterial !== FALLBACK ? resolvedMaterial : null;
  const color = input.countertopColorCode?.trim() || null;
  const matBlock = !isVessel && mat ? `-CT-${mat}${color ? `-${color}` : ""}` : "";

  // Series is dynamic: "UR" + materialSku (e.g. "URFX", "URHPL", "URPOR")
  const series = mat ? `UR${mat}` : "URFX";

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

  return lines;
}
