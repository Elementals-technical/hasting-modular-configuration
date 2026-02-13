export type TowelBarSkuInput = {
  /** "L" (left) or "R" (right) */
  side: "L" | "R";
  width: number | null;
  height: number | null;
  depth: number | null;
  /** Material SKU (e.g. "LACM") */
  materialSku: string | null;
  /** Color code without finish suffix (e.g. "FE") */
  colorCode: string | null;
};

const FALLBACK = "X";
const CATEGORY = "VAN";
const SERIES = "URTWLBR";

/** Side config codes */
const sideConfigMap: Record<string, string> = {
  L: "STB/L",
  R: "STB/R",
};

/** Default towel-bar dimensions (current model: TowelBar40) */
export const TOWEL_BAR_DEFAULTS = { width: 40, height: 5, depth: 3 } as const;

/**
 * Builds a full product SKU for a towel-bar accessory.
 *
 * Example output:
 * VAN-URTWLBR-STBR-40W-5H-3D-TWLBR-LACM-FE
 * VAN-URTWLBR-STBL-40W-5H-3D-TWLBR-LACM-FE
 */
export function buildTowelBarSku(input: TowelBarSkuInput): string | null {
  const mat = input.materialSku?.trim();
  if (!mat) return null;

  const config = sideConfigMap[input.side];

  const w = input.width != null ? `${input.width}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${input.height}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${input.depth}D` : `${FALLBACK}D`;

  const color = input.colorCode?.trim();
  const triplet = color ? `TWLBR-${mat}-${color}` : `TWLBR-${mat}`;

  return `${CATEGORY}-${SERIES}-${config}-${w}-${h}-${d}-${triplet}`;
}
