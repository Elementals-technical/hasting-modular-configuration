import { cmToInches } from "./cmToInches";

export type TowelBarSkuInput = {
  /** "L" (left) or "R" (right) */
  side: "L" | "R";
  width: number | null;
  height: number | null;
  depth: number | null;
  /** Material SKU (e.g. "LACM") */
  materialSku: string | null;
  /** Towel bar color value or code (e.g. "Carbone 43 MT" or "43 MT") */
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

const normalizeTowelBarColorCode = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  // Keep only the pricing-relevant code token from labels like:
  // "Carbone 43 MT", "Bianco 0B MT", "Metallizzato Copper M7 MT".
  const match = normalized.match(/\b([A-Za-z0-9]{2,3})\s*(MT)\b/i);
  if (!match) return null;

  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
};

/** Default towel-bar dimensions (current model: TowelBar40) */
export const TOWEL_BAR_DEFAULTS = { width: 40, height: 3.5, depth: 5 } as const;

/**
 * Builds a full product SKU for a towel-bar accessory.
 *
 * Example output:
 * VAN-URTWLBR-STB/R-15.7W-1.4H-2D-LACM-43 MT
 * VAN-URTWLBR-STB/L-15.7W-1.4H-2D-LACM-43 MT
 */
export function buildTowelBarSku(input: TowelBarSkuInput): string | null {
  const mat = input.materialSku?.trim();
  if (!mat) return null;
  const color = normalizeTowelBarColorCode(input.colorCode);

  const config = sideConfigMap[input.side];

  const w = input.width != null ? `${cmToInches(input.width)}W` : `${FALLBACK}W`;
  const h = input.height != null ? `${cmToInches(input.height)}H` : `${FALLBACK}H`;
  const d = input.depth != null ? `${cmToInches(input.depth)}D` : `${FALLBACK}D`;

  return color
    ? `${CATEGORY}-${SERIES}-${config}-${w}-${h}-${d}-${mat}-${color}`
    : `${CATEGORY}-${SERIES}-${config}-${w}-${h}-${d}-${mat}`;
}
