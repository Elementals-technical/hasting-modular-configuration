import { toSkuDepth } from "./toSkuDepth";

export type DividerSkuInput = {
  /** Divider style from state: "Option A" | "Option B" | "Option C" | "None" */
  dividerStyle: string | null;
  /** Cabinet depth in cm. Used to resolve the divider insert depth token. */
  cabinetDepth: number | null;
};

const CATEGORY = "VAN";
const SERIES = "URDIV";

/** Divider option → pricing code for the URDIV SKU */
const dividerPricingMap: Record<string, string> = {
  "Option A": "A",
  "Option B": "B",
  "Option C": "C",
};

type DividerDimensionSet = {
  width: number;
  height: number;
};

const dividerDimensionsByCode: Record<string, DividerDimensionSet> = {
  A: { width: 5.3, height: 2.4 },
  B: { width: 6.7, height: 2.4 },
  C: { width: 8.7, height: 2.4 },
};

const dividerDepthByCabinetDepth: Record<number, number> = {
  46: 13,
  50: 15,
};

const formatDimensionToken = (value: number): string => {
  const normalized = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return normalized.replace(/\.?0+$/, "");
};

/**
 * Builds a pricing SKU for a divider accessory (Resolver 4).
 *
 * Width/height are defined by the divider style. Depth is resolved from the
 * cabinet depth because the same divider style has different depth variants.
 *
 * Example: VAN-URDIV-A-5.3W-2.4H-15D
 */
export function buildDividerSku(input: DividerSkuInput): string | null {
  if (!input.dividerStyle || input.dividerStyle === "None") return null;

  const code = dividerPricingMap[input.dividerStyle];
  if (!code) return null;

  const dimensions = dividerDimensionsByCode[code];
  const depth = input.cabinetDepth != null ? dividerDepthByCabinetDepth[toSkuDepth(input.cabinetDepth)] : null;
  if (!dimensions || depth == null) return null;

  const w = `${formatDimensionToken(dimensions.width)}W`;
  const h = `${formatDimensionToken(dimensions.height)}H`;
  const d = `${formatDimensionToken(depth)}D`;

  return `${CATEGORY}-${SERIES}-${code}-${w}-${h}-${d}`;
}
