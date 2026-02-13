import { countertopStyleSkuMap, basinSkuMap } from "./countertopSkuMaps";

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
const SERIES = "URFX";

const resolve = (map: Record<string, string>, value: string | null): string => {
  if (!value) return FALLBACK;
  return map[value] ?? FALLBACK;
};

/**
 * Returns an array of SKU lines for the countertop:
 *  [0] Top        — always present  CT-URFX-{STYLE}-{W}W-{THICKNESS}H-{D}D-CT-{MatSKU}-{Color}
 *  [1] Basin      — if style is integrated or vessel  CT-URFX-{BASIN}
 *  [2] Faucet Qty — if faucet holes > 0  CT-URFX-FAHO/{QTY}
 *  [3] Faucet Spc — if faucet holes > 0  CT-URFX-FAHOS/{SPACING}
 *  [4] Hole Cut   — if style is vessel   CT-URFX-HCUT
 */
export function buildCountertopSku(input: CountertopSkuInput): string[] {
  const styleValue = (input.style?.trim() || "plain").toLowerCase();
  const styleSku = resolve(countertopStyleSkuMap, styleValue);

  // Dimensions (W-H-D format; thickness uses H suffix)
  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const rawT = input.thickness?.trim();
  const t = rawT ? `${rawT}H` : FALLBACK;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  // Material block: -CT-{MaterialSKU}-{ColorCode}
  const mat = input.countertopMaterialSku?.trim() || null;
  const color = input.countertopColorCode?.trim() || null;
  const matBlock = mat ? `-CT-${mat}${color ? `-${color}` : ""}` : "";

  // Top line — always present
  const top = `${CATEGORY}-${SERIES}-${styleSku}-${w}-${t}-${d}${matBlock}`;
  const lines: string[] = [top];

  const isIntegrated = styleValue === "integrated";
  const isVessel = styleValue === "vessel";

  // Basin — only for integrated / vessel
  if ((isIntegrated || isVessel) && input.basinType) {
    const basinSku = resolve(basinSkuMap, input.basinType);
    if (basinSku !== FALLBACK) {
      lines.push(`${CATEGORY}-${SERIES}-${basinSku}`);
    }
  }

  // Faucet holes
  const holesQty = input.faucetHolesAmount?.trim() || "0";
  if (holesQty !== "0" && holesQty !== "") {
    lines.push(`${CATEGORY}-${SERIES}-FAHO/${holesQty}`);

    const spacing = input.faucetHolesSpacing?.replace(/"/g, "").trim() || null;
    if (spacing) {
      lines.push(`${CATEGORY}-${SERIES}-FAHOS/${spacing}`);
    }
  }

  // Hole cutout — only for vessel
  if (isVessel) {
    lines.push(`${CATEGORY}-${SERIES}-HCUT`);
  }

  return lines;
}
